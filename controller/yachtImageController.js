//getYachtImageById
const YachtImage = require("../model/yachtImages");
const Yacht = require("../model/yachtSchema");
const mongoose = require("mongoose");
exports.getYachtImageById = async (req, res) => {
  try {
    const yachtId = req.params.id;
    const yachtImage = await YachtImage.findOne({ yachtId: yachtId });
    if (!yachtImage || !yachtImage.imageUrl || (Array.isArray(yachtImage.imageUrl) && yachtImage.imageUrl.length === 0)) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }
    // Nếu imageUrl là mảng, trả về từng url với idYachtImage
    let dataArr = [];
    if (Array.isArray(yachtImage.imageUrl)) {
      dataArr = yachtImage.imageUrl.map(url => ({
        idYachtImage: yachtImage._id,
        url,
      }));
    } else {
      dataArr = [{ idYachtImage: yachtImage._id, url: yachtImage.imageUrl }];
    }
    res.status(200).json({
      success: true,
      data: dataArr,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while retrieving images",
      error: error.message,
    });
  }
};
