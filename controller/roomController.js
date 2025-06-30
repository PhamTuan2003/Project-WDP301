const Room = require("../model/roomSchema");
const BookingRoom = require("../model/bookingRoom");
const BookingOrder = require("../model/bookingOrder");
const RoomType = require("../model/roomType");
const Yacht = require('../model/yachtSchema');
const YachtType = require('../model/yachtType');
const Company = require('../model/company');
const Location = require('../model/location');
const cloudinary = require('../utils/configClound')
const Service = require('../model/service');
const YachtService = require('../model/yachtService');
const Schedule = require('../model/schedule');
const YachtSchedule = require('../model/yachtSchedule');

const getRoomsWithTypes = async (req, res) => {
  try {
    const { yachtId, scheduleId, maxPeople } = req.query;
    if (!yachtId) {
      return res.status(400).json({
        success: false,
        message: "yachtId is required",
      });
    }

    // Build query
    const query = { yachtId };
    if (maxPeople && maxPeople !== "all") {
      query.max_people = parseInt(maxPeople);
    }

    // Find rooms and populate roomTypeId
    let rooms = await Room.find(query).populate({
      path: "roomTypeId",
      select: "name price",
    });

    // Filter out booked rooms if scheduleId is provided
    if (scheduleId) {
      const bookings = await BookingOrder.find({ scheduleId });
      const bookedRoomIds = await BookingRoom.find({
        bookingId: { $in: bookings.map((b) => b._id) },
      }).distinct("roomId");
      rooms = rooms.filter((room) => !bookedRoomIds.includes(room._id));
    }

    // Format rooms for the frontend
    const formattedRooms = rooms.map((room) => ({
      id: room._id,
      name: room.name,
      description: room.description,
      area: room.area,
      avatar: room.avatar,
      max_people: room.max_people,
      price: room.roomTypeId?.price || 0,
    }));

    res.status(200).json({
      success: true,
      message: "Lấy danh sách phòng thành công",
      data: { rooms: formattedRooms },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách phòng",
      error: error.message,
    });
  }
};

const createRoom = async (req, res) => {
    try {
        const { name, description, area, roomTypeId, yachtId } = req.body;

        if (!name || !area || !roomTypeId || !yachtId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const avatar = req.file && req.file.path ? req.file.path : '';

        const room = new Room({
            name,
            description,
            area,
            avatar,
            roomTypeId,
            yachtId
        });

        await room.save();

        res.status(201).json({
            message: 'Room created successfully',
            room
        });
    } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const createRoomType = async (req, res) => {
    try {
        const { type, utility, price, yachtId } = req.body;

        if (!type || !utility || !price || !yachtId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const roomType = new RoomType({
            type,
            utility,
            price,
            yachtId
        });

        await roomType.save();

        res.status(201).json({
            message: 'Room type created successfully',
            roomType
        });
    } catch (error) {
        console.error('Error creating room type:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {getRoomsWithTypes, createRoom, createRoomType };
