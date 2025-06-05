const {BookingOrder} = require('../model/bookingOrder')
const Yacht = require('../model/yachtSchema');
const YachtType = require('../model/yachtType');
const Company = require('../model/company');
const Location = require('../model/location');
const cloudinary = require('../utils/configClound')
const Service = require('../model/service');
const YachtService = require('../model/yachtService');
const Schedule = require('../model/schedule');
const YachtSchedule = require('../model/yachtSchedule');
const RoomType = require('../model/roomType')
const Room = require('../model/roomSchema');
const ExcelJS = require('exceljs');


const getRevenueBooking = async (req, res) => {
  try {
    const { idCompany, month, year } = req.query;

    const now = new Date();
    const selectedMonth = month || (now.getMonth() + 1).toString(); // JS month is 0-based
    const selectedYear = year || now.getFullYear().toString();

    const startDate = new Date(`${selectedYear}-${selectedMonth}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1); // kết thúc vào đầu tháng sau

    const bookings = await BookingOrder.find({
      companyId: idCompany,
      createdAt: {
        $gte: startDate,
        $lt: endDate
      }
    });

    const total = bookings.reduce((sum, order) => sum + (order.amount || 0), 0);

    res.status(200).json({ revenue: Math.round(total) });
  } catch (error) {
    console.error('Error getting revenue:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getRevenueService = async (req, res) => {
  try {
    const { idCompany, month, year } = req.query;

    const now = new Date();
    const selectedMonth = parseInt(month || (now.getMonth() + 1));
    const selectedYear = parseInt(year || now.getFullYear());

    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 1);

    // Step 1: Tìm các yacht thuộc company
    const yachts = await Yacht.find({ IdCompanys: idCompany }).select('_id');
    const yachtIds = yachts.map(y => y._id);

    // Step 2: Tìm schedule của các yacht đó
    const schedules = await Schedule.find({
      yachtId: { $in: yachtIds },
      startDate: { $gte: startDate, $lt: endDate }
    }).select('_id');
    const scheduleIds = schedules.map(s => s._id);

    // Step 3: Tìm các bookingOrder có scheduleId
    const bookingOrders = await BookingOrder.find({
      scheduleId: { $in: scheduleIds }
    }).select('_id');

    const bookingIds = bookingOrders.map(b => b._id);

    // Step 4: Tìm các bookingService liên quan
    const bookingServices = await BookingService.find({
      bookingId: { $in: bookingIds }
    }).populate('serviceId');

    // Step 5: Tính tổng giá dịch vụ
    let total = 0;
    for (const bs of bookingServices) {
      if (bs.serviceId?.price) {
        total += bs.serviceId.price;
      }
    }

    res.status(200).json({ revenueFromService: Math.round(total) });

  } catch (error) {
    console.error('Error getting revenue from service:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

async function getBookings(idCompany, month, year) {
  // Xác định tháng và năm để lọc
  const m = month || (new Date().getMonth() + 1);
  const y = year || new Date().getFullYear();

  // Tạo ngày bắt đầu tháng
  const startDate = new Date(y, m - 1, 1);
  // Ngày kết thúc là ngày đầu tháng kế tiếp
  const endDate = new Date(y, m, 1);

  // Query Mongoose
  return BookingOrder.find({
    IdCompanys: idCompany, // trường company trong BookingOrder (bạn sửa tên đúng nếu khác)
    bookingDate: { $gte: startDate, $lt: endDate }
  })
    .populate('customerId')
    .populate('scheduleId')
    .exec();
}

const exportBooking = async (req, res) => {
  try {
    const { idCompany } = req.params;
    let { month, year } = req.query;

    // Nếu cả month và year là empty string, gán undefined để hàm getBookings tự lấy hiện tại
    if (month === '') month = undefined;
    if (year === '') year = undefined;

    // Lấy booking theo logic Java đã cho
    const bookingOrders = await getBookings(idCompany, month, year);

    // Tạo workbook ExcelJS
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Booking Orders');

    // Header
    const headers = [
      'ID Booking', 'Amount', 'Booking Time', 'Requirement', 'Status',
      'Customer Name', 'Customer Email', 'Customer Address', 'Customer Phone',
      'Schedule Start', 'Schedule End', 'Reason'
    ];
    sheet.addRow(headers);

    bookingOrders.forEach(order => {
      sheet.addRow([
        order._id ? order._id.toString() : 'N/A',
        order.amount || 0,
        order.bookingDate ? order.bookingDate.toISOString() : 'N/A',
        order.requirements || 'N/A',
        order.status || 'N/A',
        order.customerId?.fullName || 'N/A',
        order.customerId?.email || 'N/A',
        order.customerId?.address || 'N/A',
        order.customerId?.phone || 'N/A',
        order.scheduleId?.startDate ? order.scheduleId.startDate.toISOString() : 'N/A',
        order.scheduleId?.endDate ? order.scheduleId.endDate.toISOString() : 'N/A',
        order.reason || 'N/A'
      ]);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Booking_Order_${month || (new Date().getMonth()+1)}_${year || new Date().getFullYear()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting booking excel:', error);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = { getRevenueBooking, getRevenueService, exportBooking };