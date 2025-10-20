// -----------------------
// Firebase v8 setup
const firebaseConfig = {
  apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
  authDomain: "tatak-mobile-web.firebaseapp.com",
  projectId: "tatak-mobile-web",
  storageBucket: "tatak-mobile-web.appspot.com",
  messagingSenderId: "771908675869",
  appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
  measurementId: "G-CENPP29LKQ"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// -----------------------
// Helper: show messages
function showMessage(message, type) {
  const messageBox = document.getElementById('messageBox');
  messageBox.textContent = message;
  messageBox.style.color = type === 'error' ? 'red' : 'green';
  messageBox.style.display = 'block';
}

// -----------------------
// Helper: generate consistent document ID for designees
function generateDesigneeDocID(data) {
  const idParts = [];
  if (data.office) idParts.push(data.office);
  if (data.department) idParts.push(data.department);
  if (data.category) idParts.push(data.category);
  return idParts.join("-") || data.userID || "unknown";
}

// -----------------------
// Approve via email link if designeeId is present
const urlParams = new URLSearchParams(window.location.search);
const designeeLinkId = urlParams.get("designeeId");

async function approveDesigneeByLink(designeeId) {
  if (!designeeId) return null;

  try {
    const pendingRef = db
      .collection("User")
      .doc("PendingDesignees")
      .collection("PendingDocs")
      .doc(designeeId);

    const pendingSnap = await pendingRef.get();
    if (!pendingSnap.exists) return null;

    const pendingData = pendingSnap.data();

    // Update status to Approved
    await pendingRef.update({
      status: "Approved",
      approvedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Designee ${designeeId} approved via email link.`);

    // Move to DesigneesDocs
    const newDocID = generateDesigneeDocID(pendingData);
    await db.collection("User")
      .doc("Designees")
      .collection("DesigneesDocs")
      .doc(newDocID)
      .set({
        ...pendingData,
        status: "Approved",
        approvedAt: pendingData.approvedAt || firebase.firestore.FieldValue.serverTimestamp()
      });

    // Return newDocID for localStorage
    return { ...pendingData, id: newDocID };

  } catch (error) {
    console.error("Error approving designee via link:", error);
    return null;
  }
}

// -----------------------
// Unified Login Handler
document.getElementById('registrationForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const userID = document.getElementById('userID').value.trim();
  const password = document.getElementById('password').value.trim();
  if (!userID || !password) {
    showMessage("Please fill in both User ID and Password.", "error");
    return;
  }

  try {
    // -----------------------
    // Step 0: Approve via email link first if present
    let linkApprovedData = null;
    if (designeeLinkId) {
      linkApprovedData = await approveDesigneeByLink(designeeLinkId);
      if (linkApprovedData) {
        localStorage.setItem("userData", JSON.stringify({
          ...linkApprovedData,
          role: "designee"
        }));
        showMessage(`Hi ${linkApprovedData.firstName}, your account has been approved! Redirecting...`, "success");
        return window.location.href = "../Designee/designee.html";
      }
    }

    // -----------------------
    // Step 1: Check DesigneesDocs
    const designeeSnap = await db.collection("User")
      .doc("Designees")
      .collection("DesigneesDocs")
      .where("userID", "==", userID)
      .limit(1)
      .get();

    if (!designeeSnap.empty) {
      const designeeData = designeeSnap.docs[0].data();
      if (designeeData.password !== password) {
        showMessage("Invalid User ID or Password.", "error");
        return;
      }
      if (designeeData.status !== "Approved") {
        showMessage("Your account is not approved yet.", "error");
        return;
      }

      const newDocID = generateDesigneeDocID(designeeData);
      localStorage.setItem("userData", JSON.stringify({
        id: newDocID, // Save generated ID here
        ...designeeData,
        role: "designee"
      }));

      return window.location.href = "../Designee/designee.html";
    }

    // -----------------------
    // Step 2: Check StaffDocs
    const staffSnap = await db.collection("User")
      .doc("Designees")
      .collection("StaffDocs")
      .where("id", "==", userID)
      .where("role", "==", "Staff")
      .limit(1)
      .get();

    if (!staffSnap.empty) {
      const staffData = staffSnap.docs[0].data();
      if (staffData.password !== password) {
        showMessage("Invalid Staff ID or Password.", "error");
        return;
      }
      if (staffData.status && staffData.status !== "Active") {
        showMessage("Your account is not active. Contact your Designee.", "error");
        return;
      }

      localStorage.setItem("userData", JSON.stringify({
        id: staffSnap.docs[0].id, // Staff keeps original doc ID
        ...staffData,
        role: "staff"
      }));

      showMessage("Login successful!", "success");
      return window.location.href = "../Designee/designee.html";
    }

    // -----------------------
    // Step 3: Fallback to PendingDesignees (manual login)
    const pendingSnap = await db.collection("User")
      .doc("PendingDesignees")
      .collection("PendingDocs")
      .where("userID", "==", userID)
      .limit(1)
      .get();

    if (!pendingSnap.empty) {
      const pendingData = pendingSnap.docs[0].data();
      if (pendingData.password !== password) {
        showMessage("Invalid User ID or Password.", "error");
        return;
      }
      if (pendingData.status !== "Approved") {
        showMessage("Not approved yet. Please check your email for the approval link.", "error");
        return;
      }

      const newDocID = generateDesigneeDocID(pendingData);
      await db.collection("User")
        .doc("Designees")
        .collection("DesigneesDocs")
        .doc(newDocID)
        .set({
          ...pendingData,
          status: "Approved",
          approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

      localStorage.setItem("userData", JSON.stringify({
        id: newDocID, // Save generated ID here
        ...pendingData,
        role: "designee"
      }));
      return window.location.href = "../Designee/designee.html";
    }

    // -----------------------
    // Step 4: Not found
    showMessage("Invalid User ID or Password.", "error");

  } catch (error) {
    console.error("Login error:", error);
    showMessage("An error occurred during login. Please try again.", "error");
  }
});
