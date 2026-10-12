const pool = require('../config/db');

exports.getRoomType = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM room_types');
        res.render('room-types', { room_types: result.rows });
    } catch (error) {
        console.error('Error fetching room types:', error);
        res.status(500).send('Error fetching room types');
    }
};


exports.createRoomType = async (req, res) => {
    const { room_type } = req.body;
    try {
        await pool.query('INSERT INTO room_types (room_type) VALUES ($1)', [room_type]);

        res.redirect('/room-type');
    } catch (error) {
        console.error('Error creating room type:', error);
        res.status(500).send('Error creating room type');
    }
};

exports.editRoomType = async (req, res) => {
    const { id } = req.params;
    const { room_type} = req.body;
    try {
        await pool.query('UPDATE room_types SET room_type = $1 WHERE id = $2', [room_type, id]);
        res.redirect('/room-type');
    } catch (error) {
        console.error('Error updating room type:', error);

        res.status(500).send('Error updating room type');
    }
};

exports.deleteRoomType = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM room_types WHERE id = $1', [id]);
        res.redirect('/room-type');
    } catch (error) {
        console.error('Error deleting room type:', error);
        res.status(500).send('Error deleting room type');
    }
};

exports.getFloors = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM floors');
        res.render('floors', { floors: result.rows });
    } catch (error) {
        console.error('Error fetching floors:', error);
        res.status(500).send('Error fetching floors');
    }
};


exports.createFloor = async (req, res) => {
    const { floor_no } = req.body;
    try {
        await pool.query('INSERT INTO floors (floor_no) VALUES ($1)', [floor_no]);
        res.redirect('/floors');
    } catch (error) {
        console.error('Error creating floor:', error);

        res.status(500).send('Error creating floor');
    }
};


exports.editFloor = async (req, res) => {
    const { id } = req.params;
    const { floor_no } = req.body;
    try {
        await pool.query('UPDATE floors SET floor_no = $1 WHERE id = $2', [floor_no, id]);
        res.redirect('/floors');
    } catch (error) {
        console.error('Error updating floor:', error);
        res.status(500).send('Error updating floor');
    }
};

exports.deleteFloor = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM floors WHERE id = $1', [id]);
        res.redirect('/floors');
    } catch (error) {
        console.error('Error deleting floor:', error);
        res.status(500).send('Error deleting floor');
    }
};

exports.getRooms = async (req, res) => {
    try {
        const result = await pool.query('SELECT rooms.*, room_types.room_type, floors.floor_no FROM rooms JOIN room_types ON rooms.room_type_id = room_types.id JOIN floors ON rooms.floor_id = floors.id');
        const roomTypes = await pool.query('SELECT * FROM room_types');   
        const floors = await pool.query('SELECT * FROM floors');
        res.render('rooms', { rooms: result.rows, roomTypes: roomTypes.rows, floors: floors.rows });
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).send('Error fetching rooms');
    }
};


exports.createRoom = async (req, res) => {
    const { room_no, room_type_id, floor_id, rate } = req.body;
    try {
        await pool.query('INSERT INTO rooms (room_no, room_type_id, floor_id, rate) VALUES ($1, $2, $3, $4)', [room_no, room_type_id, floor_id, rate]);   
        res.redirect('/rooms');
    } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).send('Error creating room');

    }
};

exports.editRoom = async (req, res) => {
    const { id } = req.params;
    const { room_no, room_type_id, floor_id, rate } = req.body;

    try {
        await pool.query('UPDATE rooms SET room_no = $1, room_type_id = $2, floor_id = $3, rate = $4 WHERE id = $5', [room_no, room_type_id, floor_id, rate, id]);
        res.redirect('/rooms');
    } catch (error) {
        console.error('Error updating room:', error);
        res.status(500).send('Error updating room');

    }
};

exports.deleteRoom = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM rooms WHERE id = $1', [id]);
        res.redirect('/rooms');
    } catch (error) {
        console.error('Error deleting room:', error);
        res.status(500).send('Error deleting room');
    }
};

exports.getBeds = async (req, res) => {
    try {
        const result = await pool.query('SELECT beds.*, rooms.room_no, rooms.rate, room_types.room_type, floors.floor_no FROM beds JOIN rooms ON beds.room_id = rooms.id JOIN room_types ON rooms.room_type_id = room_types.id JOIN floors ON rooms.floor_id = floors.id');
        const rooms = await pool.query('SELECT rooms.*, room_types.room_type, floors.floor_no FROM rooms LEFT JOIN room_types ON rooms.room_type_id = room_types.id LEFT JOIN floors ON rooms.floor_id = floors.id');
        res.render('beds', { beds: result.rows, rooms: rooms.rows });
    } catch (error) {
        console.error('Error fetching beds:', error);
        res.status(500).send('Error fetching beds');
    }
};


exports.createBed = async (req, res) => {
    const { bed_no, room_id } = req.body;
    try {
        await pool.query('INSERT INTO beds (bed_no, room_id) VALUES ($1, $2)', [bed_no, room_id]);
        res.redirect('/beds');
    } catch (error) {
        console.error('Error creating bed:', error);
        res.status(500).send('Error creating bed');
    }
};

exports.editBed = async (req, res) => {
    const { id } = req.params;
    const { bed_no, room_id } = req.body;
    try {
        await pool.query('UPDATE beds SET bed_no = $1, room_id = $2 WHERE bed_id = $3', [bed_no, room_id, id]);
        res.redirect('/beds');
    } catch (error) {
        console.error('Error updating bed:', error);
        res.status(500).send('Error updating bed');
    }
};

exports.deleteBed = async (req, res) => {   
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM beds WHERE bed_id = $1', [id]);
        res.redirect('/beds');
    } catch (error) {

        console.error('Error deleting bed:', error);
        res.status(500).send('Error deleting bed');
    }
};








