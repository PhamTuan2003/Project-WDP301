const YachtService = require("../model/yachtService");
const Service = require("../model/service");

// Lấy danh sách dịch vụ theo yachtId
exports.getServicesByYacht = async (req, res) => {
  try {
    const { yachtId } = req.params;
    // Lấy các dịch vụ của du thuyền này
    const yachtServices = await YachtService.find({ yachtId }).populate(
      "serviceId"
    );
    // Map sang trả về name, price, _id...
    const services = yachtServices.map((ys) => {
      const service = ys.serviceId;
      return {
        _id: service._id,
        name: service.serviceName,
        price: service.price,
        yachtServiceId: ys._id,
        yachtId: ys.yachtId,
      };
    });
    res.json(services);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
