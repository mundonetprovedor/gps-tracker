const mongoose = require('mongoose');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo:27017/mundonet_gps';

const ServiceOrderSchema = new mongoose.Schema({}, { strict: false });
const ServiceOrder = mongoose.model('ServiceOrder', ServiceOrderSchema);

async function checkMongoOS() {
  try {
    await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 3000 });
    console.log('✅ Connected to MongoDB');

    const total = await ServiceOrder.countDocuments();
    const onlineCount = await ServiceOrder.countDocuments({ loginStatus: 'online' });
    const offlineCount = await ServiceOrder.countDocuments({ loginStatus: 'offline' });
    const nullCount = await ServiceOrder.countDocuments({ loginStatus: { $in: [null, undefined] } });

    console.log(`Total O.S. in MongoDB: ${total}`);
    console.log(`  Online loginStatus: ${onlineCount}`);
    console.log(`  Offline loginStatus: ${offlineCount}`);
    console.log(`  Null/Undefined loginStatus: ${nullCount}`);

    const samples = await ServiceOrder.find().limit(10).lean();
    console.log('\nSample 10 O.S. in DB:');
    samples.forEach(s => {
      console.log(`  OS #${s.number} | ixcId: ${s.ixcId} | client: "${s.client}" | status: ${s.status} | loginStatus: "${s.loginStatus}"`);
    });

  } catch (err) {
    console.error('Mongo connection error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkMongoOS();
