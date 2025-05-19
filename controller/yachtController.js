const { YachtSchema, YachtService } = require("../model");
const cloudinary = require("../utils/configClound");

// Hàm lấy tất cả du thuyền
const getAllYacht = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 0; // Nếu không có thì lấy 0 (tức là không giới hạn)

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

// hàm tao mới một chiếc du thuyền
const createYacht = async (req, res) => {
  try {
    const { name, launch, description, hullBody, rule, itinerary, location_id, yachtType_id, id_companys } = req.body;
    let imageUrl = "";

    if (req.file) {
      const result = await cloudinary.uploader.upload_stream({ folder: "yachts" }, (error, result) => {
        if (error) {
          console.error("Error uploading image:", error);
          return res.status(500).json({ message: "Error uploading image" });
        }
        imageUrl = result.secure_url;

        const yacht = new Yacht({
          name,
          image: imageUrl,
          launch,
          description,
          hullBody,
          rule,
          itinerary,
          location_id,
          yachtType_id,
          id_companys,
        });
        yacht
          .save()
          .then(() => {
            res.status(201).json(yacht);
          })
          .catch((error) => {
            console.error("Error saving yacht:", error);
            res.status(500).json({ message: "Error saving yacht" });
          });
      });
      result.end(req.file.buffer);
    } else {
      res.status(400).json({ message: "No image file provided" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createYacht, getAllYacht, getAllServices };
