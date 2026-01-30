import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app, process.env.FIREBASE_STORAGE_BUCKET);

export const uploadToFirebase = async (file: any, folder: string = "listings"): Promise<string> => {
    try {
        const fileName = `${Date.now()}-${file.name}`;
        const storageRef = ref(storage, `${folder}/${fileName}`);

        // Use tempFilePath if useTempFiles is enabled in express-fileupload
        const fileBuffer = file.tempFilePath ? fs.readFileSync(file.tempFilePath) : file.data;

        if (!fileBuffer || fileBuffer.length === 0) {
            throw new Error("File buffer is empty or undefined");
        }

        // Upload the file buffer
        const snapshot = await uploadBytes(storageRef, fileBuffer, {
            contentType: file.mimetype
        });

        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error("Firebase upload error:", error);
        throw error;
    }
};
