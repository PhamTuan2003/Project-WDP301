const express = require("express");
const router = express.Router();
const {
  getAllYacht,
  getAllServices,
  searchYachts,
  getFeedbacksByYacht,
  getSchedulesByYacht,
  getYachtById,
  getServicesByYachtId,
} = require("../controller/yachtController");

router.get("/", getAllYacht);
router.get("/services", getAllServices);
router.get("/findboat", searchYachts);
router.get("/findboat/:id", getYachtById);
router.get("/:id/feedbacks", getFeedbacksByYacht);
router.get("/:id/services", getServicesByYachtId);
router.get("/:id/schedules", getSchedulesByYacht);

module.exports = router;
