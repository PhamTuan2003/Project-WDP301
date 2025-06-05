const Yacht = require('../model/yachtSchema');
const YachtType = require('../model/yachtType');
const Company = require('../model/company');
const Location = require('../model/location');
const cloudinary = require('../utils/configClound')
const Service = require('../model/service');
const YachtService = require('../model/yachtService');
const Schedule = require('../model/schedule');
const YachtSchedule = require('../model/yachtSchedule');

const createYacht = async (req, res) => {
    try {
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
            location_id,
            yachtType_id,
            id_companys
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



module.exports = {
    createYacht,
    addServiceToYacht,
    addScheduleToYacht,
    updateYacht
}





