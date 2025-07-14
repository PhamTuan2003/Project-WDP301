const express = require("express");
const router = express.Router();

const {
  getAllCompany,
  getAllCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  countCompanies,
  getRevenueBooking,
  getRevenueService,
  getMonthlyRevenue,
  exportBooking,
  getInfoCompany,
} = require("../controller/companyController");

// CRUD COMPANY
router.post("/", createCompany); // Tạo công ty
router.get("/", getAllCompany); // Lấy company có exist = 1 (cho FE hiển thị)
router.get("/all", getAllCompanies); // Lấy tất cả (cả exist = 0)
router.put("/:id", updateCompany); // Cập nhật
router.delete("/:id", deleteCompany); // Xoá
router.get("/count", countCompanies); // Đếm tổng

// DOANH THU
router.get("/revenue/booking", getRevenueBooking); // Doanh thu từ booking
router.get("/revenue/service", getRevenueService); // Doanh thu từ dịch vụ
router.get("/revenue/monthly", getMonthlyRevenue); // Tổng hợp từng tháng

// EXPORT FILE
router.get("/export/:idCompany", exportBooking); // Xuất file Excel

router.get("/info/:id", getInfoCompany); // Lấy thông tin công ty theo ID

module.exports = router;
