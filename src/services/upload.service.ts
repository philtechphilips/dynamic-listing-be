/**
 * =============================================================================
 * FILE UPLOAD SERVICE
 * =============================================================================
 * 
 * This module handles file uploads to Firebase Storage.
 * It provides a centralized way to upload images and other files.
 * 
 * Configuration:
 * - Set Firebase environment variables (FIREBASE_API_KEY, etc.)
 * - Ensure Firebase Storage rules allow uploads to the target folder
 * 
 * @module services/upload.service
 */

import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================

/**
 * Firebase configuration object.
 * All values are loaded from environment variables.
 */
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

/** Firebase app instance */
const app = initializeApp(firebaseConfig);

/** Firebase Storage instance */
const storage = getStorage(app, process.env.FIREBASE_STORAGE_BUCKET);

// ============================================================================
// UPLOAD FUNCTIONS
// ============================================================================

/**
 * Uploads a file to Firebase Storage.
 * 
 * This function handles file uploads from express-fileupload middleware.
 * It supports both buffer-based and temp-file-based uploads.
 * 
 * @param {any} file - The file object from express-fileupload
 * @param {string} [folder="listings"] - The storage folder to upload to
 * @returns {Promise<string>} The public download URL of the uploaded file
 * @throws {Error} If upload fails or file buffer is empty
 * 
 * @example
 * // In a controller
 * const file = req.files?.image;
 * const imageUrl = await uploadToFirebase(file, 'listings');
 * 
 * @note Firebase Storage rules must allow writes to the target folder.
 *       The default rules match /listings/{allPaths=**}.
 */
export const uploadToFirebase = async (
  file: any,
  folder: string = "listings",
): Promise<string> => {
  try {
    // Generate unique filename with timestamp
    const fileName = `${Date.now()}-${file.name}`;

    // Create storage reference in the specified folder
    // Note: Firebase rules must allow writes to this folder
    const storageRef = ref(storage, `${folder}/${fileName}`);

    // Handle both buffer and temp file uploads
    // express-fileupload can use either depending on configuration
    const fileBuffer = file.tempFilePath
      ? fs.readFileSync(file.tempFilePath)
      : file.data;

    // Validate file content
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error("File buffer is empty or undefined");
    }

    // Upload the file to Firebase Storage
    const snapshot = await uploadBytes(storageRef, fileBuffer, {
      contentType: file.mimetype,
    });

    // Get and return the public download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Firebase upload error:", error);
    throw error;
  }
};

