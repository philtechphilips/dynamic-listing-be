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
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
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

/**
 * Deletes a file from Firebase Storage using its download URL.
 *
 * This function extracts the file path from a Firebase Storage download URL
 * and deletes the corresponding file from storage.
 *
 * @param {string} fileUrl - The Firebase Storage download URL of the file to delete
 * @returns {Promise<boolean>} True if deletion was successful, false otherwise
 *
 * @example
 * // In a controller before deleting a listing
 * if (listing.featuredImage) {
 *   await deleteFromFirebase(listing.featuredImage);
 * }
 *
 * @note This function will not throw an error if the file doesn't exist.
 *       It silently returns false in case of any errors.
 */
export const deleteFromFirebase = async (fileUrl: string): Promise<boolean> => {
  try {
    if (!fileUrl || !fileUrl.includes("firebase")) {
      // Not a Firebase URL, skip deletion
      return false;
    }

    // Extract the file path from the Firebase Storage URL
    // URLs look like: https://firebasestorage.googleapis.com/v0/b/bucket/o/folder%2Ffilename?alt=media&token=xxx
    const urlObj = new URL(fileUrl);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+?)(\?|$)/);

    if (!pathMatch || !pathMatch[1]) {
      console.warn("Could not extract file path from URL:", fileUrl);
      return false;
    }

    // Decode the URL-encoded path (e.g., %2F -> /)
    const filePath = decodeURIComponent(pathMatch[1]);

    // Create a reference to the file
    const fileRef = ref(storage, filePath);

    // Delete the file
    await deleteObject(fileRef);

    console.log(`Successfully deleted file from Firebase Storage: ${filePath}`);
    return true;
  } catch (error: any) {
    // If the file doesn't exist, just log and continue
    if (error.code === "storage/object-not-found") {
      console.log("File not found in Firebase Storage, skipping deletion");
      return false;
    }

    console.error("Firebase delete error:", error);
    return false;
  }
};
