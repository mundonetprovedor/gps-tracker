const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/mundonet_gps';

const ServiceHistory = mongoose.model('ServiceHistory', new mongoose.Schema({
  durationDrive: Number,
  durationService: Number
}));

async function fixNegatives() {
  await mongoose.connect(MONGO_URL);
  console.log('Conectado ao MongoDB');

  const result1 = await ServiceHistory.updateMany(
    { durationDrive: { $lt: 0 } },
    { $set: { durationDrive: 0 } }
  );
  console.log(`Corrigidos ${result1.modifiedCount} registros com durationDrive negativo.`);

  const result2 = await ServiceHistory.updateMany(
    { durationService: { $lt: 0 } },
    { $set: { durationService: 0 } }
  );
  console.log(`Corrigidos ${result2.modifiedCount} registros com durationService negativo.`);

  await mongoose.disconnect();
}

fixNegatives().catch(console.error);
