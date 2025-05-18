const { location, company, yachtType, Yacht } = require("../model");
const cloudinary = require("../utils/configClound");

// hàm tao mới một chiếc du thuyền
const createYacht = async (req, res) => {
  try {
    const { name, launch, description, hullBody, rule, itinerary, location_id, yachtType_id, id_companys } =
      req.body;
    let imageUrt = "";

    if (req.file) {
      const result = await cloudinary.uploader.upload_stream({ folder: "yachts" }, (error, result) => {
        if (error) {
          console.error("Error uploading image:", error);
          return res.status(500).json({ message: "Error uploading image" });
        }
        imageUrt = result.secure_url;

        const yacht = new Yacht({
          name,
          image: imageUrt,
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

module.exports = { createYacht };
