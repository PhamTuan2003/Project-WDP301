const Service = require("../model/service");

// Lấy danh sách dịch vụ theo yachtId
exports.getServicesByYacht = async (req, res) => {
  try {
    const { yachtId } = req.params;
    // Giả sử Service có trường yachtId, nếu không thì trả về tất cả dịch vụ
    // const services = await Service.find({ yachtId });
    // Nếu dịch vụ dùng chung cho tất cả yacht:
    const services = await Service.find();
    res.json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
