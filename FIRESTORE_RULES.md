# Firestore Security Rules

Copy and paste these security rules into your Firebase Console under:
**Firebase Console > Firestore Database > Rules**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is admin
    // Note: Replace "l8ly3WOk2VQda4zLmeck4CORKbt1" with your actual Firebase Auth UID
    function isAdmin() {
      return request.auth != null && (
        request.auth.uid == "l8ly3WOk2VQda4zLmeck4CORKbt1" ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin"
      );
    }

    function isAuthenticated() {
      return request.auth != null;
    }

    // --- Users Collection ---
    // Anyone authenticated can read user profiles (needed for username search and author display)
    // Only the user themselves or an admin can update their profile
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && request.auth.uid == userId;
      allow update, delete: if isAuthenticated() && (request.auth.uid == userId || isAdmin());
    }

    // --- Usernames Registry ---
    // Used to guarantee unique usernames across all users
    match /usernames/{username} {
      allow read: if true;
      allow create: if isAuthenticated() && request.resource.data.uid == request.auth.uid;
      allow update, delete: if isAuthenticated() && (resource.data.uid == request.auth.uid || isAdmin());
    }

    // --- Universal / Admin Exams Collection ---
    // Every authenticated user can read & take universal exams
    // Only the admin can create, edit, or delete universal exams
    match /exams/{examId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // --- User-Created Exams Collection ---
    // Users can read an exam if:
    // 1. They are an admin
    // 2. They created it (owner)
    // 3. The exam is marked 'public'
    // 4. Their UID is in the exam's 'sharedWith' list
    match /userExams/{examId} {
      allow read: if isAuthenticated() && (
        isAdmin() ||
        resource.data.ownerId == request.auth.uid ||
        resource.data.visibility == 'public' ||
        (resource.data.sharedWith is list && request.auth.uid in resource.data.sharedWith)
      );
      allow create: if isAuthenticated() && (
        request.resource.data.ownerId == request.auth.uid || isAdmin()
      );
      allow update, delete: if isAuthenticated() && (
        resource.data.ownerId == request.auth.uid || isAdmin()
      );
    }

    // --- Per-User Exam Attempt History ---
    // Strictly private to each user. No other user (and not even admin) can view another user's personal test history.
    match /userHistory/{userId}/attempts/{attemptId} {
      allow read, write: if isAuthenticated() && request.auth.uid == userId;
    }
  }
}
```

---

## Initial Setup Instructions in Firebase Console

1. **Enable Authentication Providers**:
   - Go to **Firebase Console > Authentication > Sign-in method**.
   - Enable **Email/Password** (enable Email/Password, leave Email link disabled).
   - Enable **Google** provider (choose your support email and click Save).

2. **Find Your Admin Firebase UID**:
   - Go to **Firebase Console > Authentication > Users**.
   - Sign up or log into your account.
   - Copy the value in the **User UID** column for your account.
   - In `script.js`, replace `"l8ly3WOk2VQda4zLmeck4CORKbt1"` with your copied UID:
     ```javascript
     const ADMIN_UID = "your-actual-firebase-uid-here";
     ```
   - In Firestore Rules above, replace `"l8ly3WOk2VQda4zLmeck4CORKbt1"` with the same UID, or set `role: "admin"` on your document in `/users/{your-uid}`.
