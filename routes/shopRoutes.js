const express = require('express');
const { Connection, PublicKey, Transaction, SystemProgram, Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const Player = require('../models/Player');
require('dotenv').config(); // Laad .env-variabelen

const router = express.Router();
const QUICKNODE_URL = "https://lingering-distinguished-choice.solana-mainnet.quiknode.pro/d4fe9c0b68107c974b8264238e41cc6b99cc09ac/";

// Private key veilig laden
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
    throw new Error("Private key not found in environment variables.");
}

const connection = new Connection(QUICKNODE_URL, 'confirmed');
const payer = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
const TO_ADDRESS = "ELRAtseMVu4w6Qw7gBJw5v8c3w9mpvYm42nmMgtbCk";

router.post("/transaction", async (req, res) => {
    const { to, item, transactionSignature } = req.body;

    console.log("Transaction data received:", req.body);

    try {
        const transactionDetails = await connection.getTransaction(transactionSignature, {
            commitment: "confirmed",
        });

        console.log("Transaction details:", transactionDetails);

        if (!transactionDetails) {
            return res.status(400).json({ error: "Transaction not found or not yet confirmed." });
        }

        const accountKeys = transactionDetails.transaction.message.accountKeys.map((key) =>
            key.toString()
        );
        console.log("Account keys in transaction:", accountKeys);

        // Controleer of de transactie naar TO_ADDRESS gaat
        if (!accountKeys.includes(TO_ADDRESS)) {
            return res.status(400).json({ error: "Transaction not directed to the correct address." });
        }

        // Verwerk beloningen
        if (item === "Buy Money") {
            await Player.findOneAndUpdate(
                { walletAddress: to },
                { $inc: { money: 1000000 } },
                { new: true }
            );
        } else if (item === "Buy Points") {
            await Player.findOneAndUpdate(
                { walletAddress: to },
                { $inc: { points: 30000 } },
                { new: true }
            );
        }

        res.status(200).json({ message: `Transaction successful for ${item}` });
    } catch (error) {
        console.error("Transaction processing error:", error);
        res.status(500).json({ error: "Failed to process transaction." });
    }
});


router.get('/balance/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;

    try {
        if (!PublicKey.isOnCurve(walletAddress)) {
            return res.status(400).json({ error: 'Invalid wallet address.' });
        }

        const balance = await connection.getBalance(new PublicKey(walletAddress));
        res.status(200).json({ balance: balance / 1e9 }); // Convert lamports to SOL
    } catch (error) {
        console.error(`Error fetching balance for wallet ${walletAddress}:`, error);
        res.status(500).json({ error: 'Failed to fetch wallet balance' });
    }
});

module.exports = router;
