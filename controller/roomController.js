const Yacht = require('../model/yachtSchema');
const YachtType = require('../model/yachtType');
const Company = require('../model/company');
const Location = require('../model/location');
const cloudinary = require('../utils/configClound')
const Service = require('../model/service');
const YachtService = require('../model/yachtService');
const Schedule = require('../model/schedule');
const YachtSchedule = require('../model/yachtSchedule');
const RoomType = require('../model/roomType')
const Room = require('../model/roomSchema');

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

module.exports = { createRoom, createRoomType };