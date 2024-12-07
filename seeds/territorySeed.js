require('dotenv').config();
const mongoose = require('mongoose');
const Territory = require('../models/territory');
const fs = require('fs');
const path = require('path');

// Laad de territoria JSON
const territories = JSON.parse(fs.readFileSync(path.join(__dirname, 'territories.json'), 'utf-8'));

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(async () => {
    console.log('Connected to MongoDB');

    // Verwijder duplicaten
    const uniqueTerritories = Array.from(
        new Map(territories.map((territory) => [territory.name, territory])).values()
    );

    // Sla de unieke lijst op
    const uniqueFilePath = path.join(__dirname, 'territories_unique.json');
    fs.writeFileSync(uniqueFilePath, JSON.stringify(uniqueTerritories, null, 2));
    console.log(`Unieke territoria opgeslagen in ${uniqueFilePath}`);

    // Verwijder bestaande territoria uit de database
    await Territory.deleteMany({});
    console.log('Oude territoria verwijderd.');

    // Voeg de unieke territoria toe aan de database
    await Territory.insertMany(uniqueTerritories);
    console.log('Territories succesvol toegevoegd aan de database.');

    mongoose.disconnect();
    console.log('MongoDB verbinding gesloten.');
}).catch((error) => {
    console.error('Fout bij verbinden met MongoDB:', error.message);
});
