# Project Blueprint: Parking Memory Helper

## Overview

This application helps users remember where they parked their car in a multi-level parking garage. It provides a visual map of the parking lot, allows users to mark their parking spot, and uses GPS to automatically detect when they are near the parking garage.

## Features

*   **Floor Selection:** Users can switch between different floors of the parking garage (B1, B2, B3).
*   **Visual Parking Grid:** A visual representation of the parking spots on each floor.
*   **Parking Spot Marking:** Users can tap on a parking spot to mark it as their own.
*   **Recent Parking History:** A list of recently parked locations.
*   **GPS Proximity Alert:** A notification appears when the user is near the parking garage, prompting them to record their parking location.
*   **Real-time Data Sync:** Parking data is saved to Firestore and synchronized in real-time across devices.
*   **Anonymous Authentication:** Users are automatically signed in anonymously to save their data.

## Project Structure

*   `index.html`: The main HTML file.
*   `style.css`: Contains the application's styles.
*   `main.js`: The core JavaScript file that handles all application logic, including Firebase integration, DOM manipulation, and GPS tracking.
*   `blueprint.md`: This file, which documents the project.

## Backend Setup (Firebase)

*   **Authentication:** Anonymous authentication will be used to create a unique user ID for each user without requiring them to sign up.
*   **Firestore:** A Firestore database will be used to store the user's parking data. The data will be structured as follows:
    ```
    /artifacts/{appId}/users/{userId}/parking/{parkingSpotId}
    ```
    Each document in the `parking` collection will contain the floor, spot ID, and timestamp of the parking event.

## Next Steps

1.  **Initialize Firebase:** Set up a new Firebase project and create a web app to obtain the necessary configuration.
2.  **Inject Firebase Configuration:** Inject the Firebase configuration into the `index.html` file so that the application can connect to the Firebase backend.
3.  **Deploy to Firebase Hosting:** Deploy the application to Firebase Hosting to make it publicly accessible.