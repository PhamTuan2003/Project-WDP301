// controllers/roomController.js
const Room = require("../model/roomSchema");
const RoomType = require("../model/roomType");

exports.getRoomsWithTypes = async (req, res) => {
  try {
    const { yachtId } = req.query;

    const roomTypes = await RoomType.find(yachtId ? { yachtId } : {})
      .populate({
        path: "yachtId",
        select: "name",
      })
      .lean();

    const rooms = await Room.find(yachtId ? { yachtId } : {})
      .populate("roomTypeId")
      .lean();

    const formattedRooms = rooms.map((room) => ({
      id: room._id.toString(),
      name: room.name,
      image: room.avatar || "/images/default-room.jpg",
      area: room.area,
      beds: room.max_people,
      price: room.roomTypeId?.price || 0,
      quantity: 0,
      type: room.roomTypeId?.type,
      description: room.description,
    }));

    res.status(200).json({
      success: true,
      data: {
        rooms: formattedRooms,
        roomTypes,
      },
    });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching room data",
      error: error.message,
    });
  }
};
