const pool = require('../config/db');

exports.getBeds = async (req, res) => {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM beds');
    client.release();
    res.json(result.rows);
};

exports.getRoomType = async (req, res) => {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM room_types');
    client.release();
    res.render('room-types', { room_types: result.rows });
};


exports.createRoomType = async (req, res) => {
    const { room_type } = req.body;
    const client = await pool.connect();
    try {
        await client.query('INSERT INTO room_types (room_type) VALUES ($1)', [room_type]);
        client.release();

        res.redirect('/room-type');
    } catch (error) {
        console.error('Error creating room type:', error);
        res.status(500).send('Error creating room type');
    } finally {
    }
};

exports.editRoomType = async (req, res) => {
    const { id } = req.params;
    const { room_type} = req.body;
    const client = await pool.connect();
    try {
        await client.query('UPDATE room_types SET room_type = $1 WHERE id = $2', [room_type, id]);
        client.release();
        res.redirect('/room-type');
    } catch (error) {
        console.error('Error updating room type:', error);

        res.status(500).send('Error updating room type');
    } finally {
    }
};

exports.deleteRoomType = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM room_types WHERE id = $1', [id]);
        client.release();
        res.redirect('/room-type');
    } catch (error) {
        console.error('Error deleting room type:', error);
        res.status(500).send('Error deleting room type');
    } finally {
    }
};

exports.getFloors = async (req, res) => {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM floors');
    client.release();
    res.render('floors', { floors: result.rows });
};


exports.createFloor = async (req, res) => {
    const { floor_no } = req.body;
    const client = await pool.connect();
    try {
        await client.query('INSERT INTO floors (floor_no) VALUES ($1)', [floor_no]);
        client.release();
        res.redirect('/floors');
    } catch (error) {
        console.error('Error creating floor:', error);

        res.status(500).send('Error creating floor');
    } finally {
    }
};


exports.editFloor = async (req, res) => {
    const { id } = req.params;
    const { floor_no } = req.body;
    const client = await pool.connect();
    try {
        await client.query('UPDATE floors SET floor_no = $1 WHERE id = $2', [floor_no, id]);
        client.release();
        res.redirect('/floors');
    } catch (error) {
        console.error('Error updating floor:', error);
        res.status(500).send('Error updating floor');
    } finally {
    }
};

exports.deleteFloor = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM floors WHERE id = $1', [id]);
        client.release();
        res.redirect('/floors');
    } catch (error) {
        console.error('Error deleting floor:', error);
        res.status(500).send('Error deleting floor');
    } finally {
    }
};

exports.getRooms = async (req, res) => {
    const client = await pool.connect();
    const result = await client.query('SELECT rooms.*, room_types.room_type, floors.floor_no FROM rooms JOIN room_types ON rooms.room_type_id = room_types.id JOIN floors ON rooms.floor_id = floors.id');
    const roomTypes = await client.query('SELECT * FROM room_types');   
    const floors = await client.query('SELECT * FROM floors');
    client.release();
    res.render('rooms', { rooms: result.rows, roomTypes: roomTypes.rows, floors: floors.rows });
};


exports.createRoom = async (req, res) => {
    const { room_no, room_type_id, floor_id, rate } = req.body;
    const client = await pool.connect();
    try {
        await client.query('INSERT INTO rooms (room_no, room_type_id, floor_id, rate) VALUES ($1, $2, $3, $4)', [room_no, room_type_id, floor_id, rate]);   
        client.release();
        res.redirect('/rooms');
    } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).send('Error creating room');

    } finally {
    }
};

exports.editRoom = async (req, res) => {
    const { id } = req.params;
    const { room_no, room_type_id, floor_id, rate } = req.body;
    console.log(room_no, room_type_id, floor_id, rate, id);
    const client = await pool.connect();

    try {
        await client.query('UPDATE rooms SET room_no = $1, room_type_id = $2, floor_id = $3, rate = $4 WHERE id = $5', [room_no, room_type_id, floor_id, rate, id]);
        client.release();
        res.redirect('/rooms');
    } catch (error) {
        console.error('Error updating room:', error);
        res.status(500).send('Error updating room');

    } finally {
    }
};

exports.deleteRoom = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM rooms WHERE id = $1', [id]);
        client.release();
        res.redirect('/rooms');
    } catch (error) {
        console.error('Error deleting room:', error);
        res.status(500).send('Error deleting room');
    } finally {
    }
};

exports.getBeds = async (req, res) => {
    const client = await pool.connect();
    const result = await client.query('SELECT beds.*, rooms.room_no, rooms.rate, room_types.room_type, floors.floor_no FROM beds JOIN rooms ON beds.room_id = rooms.id JOIN room_types ON rooms.room_type_id = room_types.id JOIN floors ON rooms.floor_id = floors.id');
    const rooms = await client.query('SELECT rooms.*, room_types.room_type, floors.floor_no FROM rooms LEFT JOIN room_types ON rooms.room_type_id = room_types.id LEFT JOIN floors ON rooms.floor_id = floors.id');
    client.release();
    res.render('beds', { beds: result.rows, rooms: rooms.rows });

};


exports.createBed = async (req, res) => {
    const { bed_no, room_id } = req.body;
    const client = await pool.connect();
    try {
        await client.query('INSERT INTO beds (bed_no, room_id) VALUES ($1, $2)', [bed_no, room_id]);
        client.release();
        res.redirect('/beds');
    } catch (error) {
        console.error('Error creating bed:', error);
        res.status(500).send('Error creating bed');
    } finally {
    }
};

exports.editBed = async (req, res) => {
    const { id } = req.params;
    const { bed_no, room_id } = req.body;
    console.log(bed_no, room_id, id);
    const client = await pool.connect();
    try {
        await client.query('UPDATE beds SET bed_no = $1, room_id = $2 WHERE bed_id = $3', [bed_no, room_id, id]);
        client.release();
        res.redirect('/beds');
    } catch (error) {
        console.error('Error updating bed:', error);
        res.status(500).send('Error updating bed');
    } finally {
    }
};

exports.deleteBed = async (req, res) => {   
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM beds WHERE bed_id = $1', [id]);
        client.release();
        res.redirect('/beds');
    } catch (error) {

        console.error('Error deleting bed:', error);
        res.status(500).send('Error deleting bed');
    } finally {
    }
};








