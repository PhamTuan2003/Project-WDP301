const {
  YachtSchema,
  YachtService,
  YachtSchedule,
  RoomType,
  Feedback,
  Schedule,
  Location,
  YachtType,
  Company,
  Service,
} = require("../model");

// Hàm lấy tất cả du thuyền
const getAllYacht = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 0;

    const yachtsQuery = YachtSchema.find()
      .populate("locationId", "-_id name")
      .populate("yachtTypeId", "-_id name ranking")
      .populate("IdCompanys", "-_id name address logo");

    if (limit > 0) {
      yachtsQuery.limit(limit); // Áp dụng giới hạn nếu có
    }

    const yachts = await yachtsQuery;

    res.status(200).json({
      success: true,
      message: "Lấy danh sách du thuyền thành công",
      data: yachts,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy du thuyền",
      error: err.message,
    });
  }
};

<<<<<<< Updated upstream
=======
const createYacht = async (req, res) => {
    try {
        const {
            name,
            launch,
            description,
            hullBody,
            rule,
            itinerary,
            locationId,
            yachtTypeId,
            IdCompanys
        } = req.body;

        // req.file.path là secure_url từ Cloudinary
        if (!req.file || !req.file.path) {
            return res.status(400).json({ message: 'Image upload failed or not provided' });
        }

        const yacht = new Yacht({
            name,
            image: req.file.path,
            launch,
            description,
            hullBody,
            rule,
            itinerary,
            locationId,
            yachtTypeId,
            IdCompanys
        });

        await yacht.save();
        res.status(201).json(yacht);
    } catch (error) {
        console.error('Error creating yacht:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};


const updateYacht = async (req, res) => {
    try {
        const yachtId = req.params.id;

        const {
            name,
            launch,
            description,
            hullBody,
            rule,
            itinerary,
            location_id,
            yachtType_id,
            id_companys
        } = req.body;

        const updateData = {
            name,
            launch,
            description,
            hullBody,
            rule,
            itinerary,
            location_id,
            yachtType_id,
            id_companys,
            updatedAt: Date.now()
        };

        // Nếu người dùng upload ảnh mới
        if (req.file && req.file.path) {
            updateData.image = req.file.path;
        }

        const updatedYacht = await Yacht.findByIdAndUpdate(
            yachtId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedYacht) {
            return res.status(404).json({ message: 'Yacht not found' });
        }

        res.status(200).json({
            message: 'Yacht updated successfully',
            yacht: updatedYacht
        });
    } catch (error) {
        console.error('Error updating yacht:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};


const addServiceToYacht = async (req, res) => {
  try {
    const { serviceName, price, yachtId } = req.body;

    if (!serviceName || price == null || !yachtId) {
      return res.status(400).json({ message: 'serviceName, price, and yachtId are required' });
    }

    // 1. Tạo dịch vụ mới
    const newService = new Service({ serviceName, price });
    const savedService = await newService.save();

    // 2. Gắn dịch vụ vào thuyền
    const yachtService = new YachtService({
      yachtId,
      serviceId: savedService._id
    });
    await yachtService.save();

    return res.status(201).json({
      message: 'Service created and added to yacht successfully',
      service: savedService
    });

  } catch (error) {
    console.error('Error adding service to yacht:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const addScheduleToYacht = async (req, res) => {
  try {
    const { startDate, endDate, yachtId } = req.body;

    if (!startDate || !endDate || !yachtId) {
      return res.status(400).json({ message: 'startDate, endDate, and yachtId are required' });
    }

    // 1. Tạo schedule mới
    const newSchedule = new Schedule({ startDate, endDate });
    const savedSchedule = await newSchedule.save();

    // 2. Gắn schedule vào yacht
    const yachtSchedule = new YachtSchedule({
      yachtId,
      scheduleId: savedSchedule._id
    });
    await yachtSchedule.save();

    return res.status(201).json({
      message: 'Schedule created and assigned to yacht successfully',
      schedule: savedSchedule
    });

  } catch (error) {
    console.error('Error adding schedule to yacht:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

>>>>>>> Stashed changes
// Hàm lấy tất cả dịch vụ của du thuyền
const getAllServices = async (req, res) => {
  try {
    const data = await YachtService.find()
      .populate({
        path: "yachtId",
        select: "-_id name",
      })
      .populate({
        path: "serviceId",
        select: "-_id serviceName price",
      });

    res.status(200).json({
      message: "Lấy danh sách dịch vụ thành công",
      data,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi khi lấy danh sách dịch vụ",
      error: error.message,
    });
  }
};

// Hàm lấy tất cả dịch vụ của du thuyền theo id
const getServicesByYachtId = async (req, res) => {
  try {
    const yachtId = req.params.id;
    const services = await YachtService.find({ yachtId })
      .populate({ path: "serviceId", select: "serviceName price" })
      .populate({ path: "yachtId", select: "name" });
    if (!services || services.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy dịch vụ cho du thuyền này",
      });
    }
    // Map lại để trả về _id thực của service
    const mapped = services.map((ys) => {
      const s = ys.serviceId;
      return {
        _id: s._id,
        serviceName: s.serviceName,
        price: s.price,
        yachtServiceId: ys._id,
        yachtId: ys.yachtId?._id || ys.yachtId,
      };
    });
    res.status(200).json({
      success: true,
      message: "Lấy danh sách dịch vụ thành công",
      data: mapped,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách dịch vụ",
      error: error.message,
    });
  }
};

// Hàm tìm kiếm du thuyền
const searchYachts = async (req, res) => {
  try {
    const { name, location, greater_defaultPrice, lower_defaultPrice, stars, durations, features } = req.query;
    let query = {};

    if (name) query.name = { $regex: name, $options: "i" };
    if (location) query.locationId = location;

    let yachts = await YachtSchema.find(query)
      .populate("locationId", "-_id name")
      .populate("yachtTypeId", "-_id name ranking")
      .populate("IdCompanys", "-_id name address logo");

    // Lọc theo số sao
    if (stars) {
      const starArray = stars.split(",").map(Number);
      yachts = await Promise.all(
        yachts.map(async (yacht) => {
          const feedbacks = await Feedback.find({ yachtId: yacht._id });
          const avgRating =
            feedbacks.length > 0
              ? Math.round(feedbacks.reduce((sum, fb) => sum + fb.starRating, 0) / feedbacks.length)
              : 0;
          return starArray.includes(avgRating) ? yacht : null;
        })
      );
      yachts = yachts.filter(Boolean);
    }

    // Lọc theo thời gian
    if (durations) {
      const durationArray = durations.split(",");
      yachts = await Promise.all(
        yachts.map(async (yacht) => {
          const schedules = await YachtSchedule.find({
            yachtId: yacht._id,
          }).populate("scheduleId");
          const yachtDurations = schedules.map((schedule) => {
            const startDate = new Date(schedule.scheduleId.startDate);
            const endDate = new Date(schedule.scheduleId.endDate);
            const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            return `${durationDays} ngày ${durationDays - 1} đêm`;
          });
          return durationArray.some((d) => yachtDurations.includes(d)) ? yacht : null;
        })
      );
      yachts = yachts.filter(Boolean);
    }

    // Lọc theo tiện ích
    if (features) {
      const featureArray = features.split(",");
      yachts = await Promise.all(
        yachts.map(async (yacht) => {
          const services = await YachtService.find({
            yachtId: yacht._id,
          }).populate("serviceId");
          const yachtFeatures = services.map((service) => service.serviceId?.serviceName).filter(Boolean);
          return featureArray.every((f) => yachtFeatures.includes(f)) ? yacht : null;
        })
      );
      yachts = yachts.filter(Boolean);
    }

    // Tính cheapestPrice
    yachts = await Promise.all(
      yachts.map(async (yacht) => {
        const roomTypes = await RoomType.find({ yachtId: yacht._id }).select("price");
        const cheapestPrice = roomTypes.length > 0 ? Math.min(...roomTypes.map((rt) => rt.price)) : null;
        return { ...yacht.toObject(), cheapestPrice };
      })
    );

    // Lọc theo giá
    if (greater_defaultPrice || lower_defaultPrice) {
      yachts = yachts.filter((yacht) => {
        const price = yacht.cheapestPrice;
        if (greater_defaultPrice && price < Number(greater_defaultPrice)) return false;
        if (lower_defaultPrice && price > Number(lower_defaultPrice)) return false;
        return true;
      });
    }

    res.status(200).json({
      success: true,
      message: "Tìm kiếm du thuyền thành công",
      data: yachts,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tìm kiếm du thuyền",
      error: err.message,
    });
  }
};

// Hàm lấy tất cả feedback của du thuyền
const getFeedbacksByYacht = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ yachtId: req.params.id })
      .populate("customerId", "-_id fullName")
      .populate("yachtId", "-_id name");
    res.status(200).json({ success: true, data: feedbacks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Hàm lấy tất cả lịch trình của du thuyền
const getSchedulesByYacht = async (req, res) => {
  try {
    const yachtSchedules = await YachtSchedule.find({ yachtId: req.params.id })
      .populate("scheduleId")
      .populate("yachtId", "name");
    res.status(200).json({ success: true, data: yachtSchedules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Hàm lấy thông tin du thuyền theo id
const getYachtById = async (req, res) => {
  try {
    const yacht = await YachtSchema.findById(req.params.id)
      .populate("locationId", "-_id name")
      .populate("yachtTypeId", "-_id name ranking")
      .populate("IdCompanys", "-_id name address logo");

    if (!yacht) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy du thuyền với id này",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lấy thông tin du thuyền thành công",
      data: yacht,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thông tin du thuyền",
      error: err.message,
    });
  }
};

// Hàm tạo du thuyền mới
const createYacht = async (req, res) => {
  try {
    const { name, launch, description, hullBody, rule, itinerary, location_id, yachtType_id, id_companys } = req.body;

    // req.file.path là secure_url từ Cloudinary
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: "Image upload failed or not provided" });
    }

    const yacht = new YachtSchema({
      name,
      image: req.file.path,
      launch,
      description,
      hullBody,
      rule,
      itinerary,
      location_id,
      yachtType_id,
      id_companys,
    });

    await yacht.save();
    res.status(201).json(yacht);
  } catch (error) {
    console.error("Error creating yacht:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//Hàm cập nhật thông tin du thuyền
const updateYacht = async (req, res) => {
  try {
    const yachtId = req.params.id;

    const { name, launch, description, hullBody, rule, itinerary, location_id, yachtType_id, id_companys } = req.body;

    const updateData = {
      name,
      launch,
      description,
      hullBody,
      rule,
      itinerary,
      location_id,
      yachtType_id,
      id_companys,
      updatedAt: Date.now(),
    };

    // Nếu người dùng upload ảnh mới
    if (req.file && req.file.path) {
      updateData.image = req.file.path;
    }

    const updatedYacht = await YachtSchema.findByIdAndUpdate(yachtId, updateData, { new: true, runValidators: true });

    if (!updatedYacht) {
      return res.status(404).json({ message: "Yacht not found" });
    }

    res.status(200).json({
      message: "Yacht updated successfully",
      yacht: updatedYacht,
    });
  } catch (error) {
    console.error("Error updating yacht:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Hàm thêm dịch vụ vào du thuyền
const addServiceToYacht = async (req, res) => {
  try {
    const { serviceName, price, yachtId } = req.body;

    if (!serviceName || price == null || !yachtId) {
      return res.status(400).json({ message: "serviceName, price, and yachtId are required" });
    }

    // 1. Tạo dịch vụ mới
    const newService = new Service({ serviceName, price });
    const savedService = await newService.save();

    // 2. Gắn dịch vụ vào thuyền
    const yachtService = new YachtService({
      yachtId,
      serviceId: savedService._id,
    });
    await yachtService.save();

    return res.status(201).json({
      message: "Service created and added to yacht successfully",
      service: savedService,
    });
  } catch (error) {
    console.error("Error adding service to yacht:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Hàm thêm lịch trình vào du thuyền
const addScheduleToYacht = async (req, res) => {
  try {
    const { startDate, endDate, yachtId } = req.body;

    if (!startDate || !endDate || !yachtId) {
      return res.status(400).json({ message: "startDate, endDate, and yachtId are required" });
    }

    // 1. Tạo schedule mới
    const newSchedule = new Schedule({ startDate, endDate });
    const savedSchedule = await newSchedule.save();

    // 2. Gắn schedule vào yacht
    const yachtSchedule = new YachtSchedule({
      yachtId,
      scheduleId: savedSchedule._id,
    });
    await yachtSchedule.save();

    return res.status(201).json({
      message: "Schedule created and assigned to yacht successfully",
      schedule: savedSchedule,
    });
  } catch (error) {
    console.error("Error adding schedule to yacht:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getAllYacht,
  getAllServices,
  searchYachts,
  getFeedbacksByYacht,
  getSchedulesByYacht,
  getYachtById,
  getServicesByYachtId,
  createYacht,
  addServiceToYacht,
  addScheduleToYacht,
  updateYacht,
};
