const { Company, Account, BookingOrder, YachtSchema, Schedule, BookingService } = require("../model");
const { sendCompanyRegisterEmail } = require('../utils/sendMail');
const ExcelJS = require("exceljs");

// ========== CRUD Company ==========

// Tạo công ty mới + account đi kèm
const createCompany = async (req, res) => {
  try {
    const { username, password, name, address, email } = req.body;

    const account = new Account({
      username,
      password,
      roles: "COMPANY",
      status: 1
    });
    await account.save();

    const company = new Company({
      name,
      address,
      email,
      accountId: account._id
    });
    await company.save();

    await sendCompanyRegisterEmail(email, name, username, password);

    res.status(201).json(company);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Cập nhật thông tin công ty
const updateCompany = async (req, res) => {
  try {
    const { name, address, email, username } = req.body;
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    company.name = name;
    company.address = address;
    company.email = email;
    await company.save();

    if (username && company.accountId) {
      await Account.findByIdAndUpdate(company.accountId, { username });
    }

    res.json({ message: 'Updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Xóa công ty + account liên kết
const deleteCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    if (company.accountId) {
      await Account.findByIdAndDelete(company.accountId);
    }

    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy tất cả công ty (không filter)
const getAllCompanies = async (req, res) => {
  try {
    const companies = await Company.find().populate('accountId');
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy các công ty có `exist = 1`
const getAllCompany = async (req, res) => {
  try {
    const companies = await Company.find()
      .populate("accountId", "-_id username roles status")
      .where("exist")
      .equals(1);

    res.status(200).json({
      success: true,
      message: "Tất cả danh sách du thuyền.",
      data: companies,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi lấy danh sách công ty.",
    });
  }
};

// Đếm số công ty
const countCompanies = async (req, res) => {
  try {
    const count = await Company.countDocuments();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ========== DOANH THU ==========

// Doanh thu theo tháng/năm từ bookingOrder
const getRevenueBooking = async (req, res) => {
  try {
    const { idCompany, month, year } = req.query;
    const now = new Date();
    const selectedMonth = month || (now.getMonth() + 1).toString();
    const selectedYear = year || now.getFullYear().toString();

    const startDate = new Date(`${selectedYear}-${selectedMonth}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const bookings = await BookingOrder.find({
      companyId: idCompany,
      createdAt: { $gte: startDate, $lt: endDate },
    });

    const total = bookings.reduce((sum, order) => sum + (order.amount || 0), 0);

    res.status(200).json({ revenue: Math.round(total) });
  } catch (error) {
    console.error("Error getting revenue:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Doanh thu từ dịch vụ
const getRevenueService = async (req, res) => {
  try {
    const { idCompany, month, year } = req.query;

    const now = new Date();
    const selectedMonth = parseInt(month || now.getMonth() + 1);
    const selectedYear = parseInt(year || now.getFullYear());

    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 1);

    const yachts = await YachtSchema.find({ IdCompanys: idCompany }).select("_id");
    const yachtIds = yachts.map((y) => y._id);

    const schedules = await Schedule.find({
      yachtId: { $in: yachtIds },
      startDate: { $gte: startDate, $lt: endDate },
    }).select("_id");
    const scheduleIds = schedules.map((s) => s._id);

    const bookingOrders = await BookingOrder.find({
      scheduleId: { $in: scheduleIds },
    }).select("_id");
    const bookingIds = bookingOrders.map((b) => b._id);

    const bookingServices = await BookingService.find({
      bookingId: { $in: bookingIds },
    }).populate("serviceId");

    let total = 0;
    for (const bs of bookingServices) {
      if (bs.serviceId?.price) {
        total += bs.serviceId.price;
      }
    }

    res.status(200).json({ revenueFromService: Math.round(total) });
  } catch (error) {
    console.error("Error getting revenue from service:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Doanh thu tổng hợp theo từng tháng + năm (FE dùng để vẽ biểu đồ)
const getMonthlyRevenue = async (req, res) => {
  try {
    const result = await BookingOrder.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$bookingDate" },
            month: { $month: "$bookingDate" }
          },
          earnings: { $sum: "$amount" }
        }
      },
      { $sort: { "_id.year": -1, "_id.month": 1 } }
    ]);

    const monthNames = [
      '', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const data = result.map(item => ({
      year: item._id.year,
      month: monthNames[item._id.month],
      earnings: item.earnings
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ========== EXPORT BOOKING EXCEL ==========

async function getBookings(idCompany, month, year) {
  const m = month || new Date().getMonth() + 1;
  const y = year || new Date().getFullYear();

  const startDate = new Date(y, m - 1, 1);
  const endDate = new Date(y, m, 1);

  return BookingOrder.find({
    IdCompanys: idCompany,
    bookingDate: { $gte: startDate, $lt: endDate },
  })
    .populate("customerId")
    .populate("scheduleId")
    .exec();
}

const exportBooking = async (req, res) => {
  try {
    const { idCompany } = req.params;
    let { month, year } = req.query;

    if (month === "") month = undefined;
    if (year === "") year = undefined;

    const bookingOrders = await getBookings(idCompany, month, year);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Booking Orders");

    const headers = [
      "ID Booking",
      "Amount",
      "Booking Time",
      "Requirement",
      "Status",
      "Customer Name",
      "Customer Email",
      "Customer Address",
      "Customer Phone",
      "Schedule Start",
      "Schedule End",
      "Reason",
    ];
    sheet.addRow(headers);

    bookingOrders.forEach((order) => {
      sheet.addRow([
        order._id ? order._id.toString() : "N/A",
        order.amount || 0,
        order.bookingDate ? order.bookingDate.toISOString() : "N/A",
        order.requirements || "N/A",
        order.status || "N/A",
        order.customerId?.fullName || "N/A",
        order.customerId?.email || "N/A",
        order.customerId?.address || "N/A",
        order.customerId?.phone || "N/A",
        order.scheduleId?.startDate ? order.scheduleId.startDate.toISOString() : "N/A",
        order.scheduleId?.endDate ? order.scheduleId.endDate.toISOString() : "N/A",
        order.reason || "N/A",
      ]);
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Booking_Order_${month || new Date().getMonth() + 1}_${year || new Date().getFullYear()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting booking excel:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getInfoCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id)
      .populate("accountId", "_id username roles status")
      .where("exist")
      .equals(1);

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found." });
    }

    res.status(200).json({
      success: true,
      message: "Company information retrieved successfully.",
      data: company,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "An error occurred while retrieving company information.",
    });
  }
};

module.exports = {
  getAllCompany,
  createCompany,
  getAllCompanies,
  countCompanies,
  deleteCompany,
  updateCompany,
  getRevenueBooking,
  getRevenueService,
  getMonthlyRevenue,
  exportBooking,
  getInfoCompany
};
