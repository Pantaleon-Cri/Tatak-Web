// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
  authDomain: "tatak-mobile-web.firebaseapp.com",
  projectId: "tatak-mobile-web",
  storageBucket: "tatak-mobile-web.firebasestorage.app",
  messagingSenderId: "771908675869",
  appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
  measurementId: "G-CENPP29LKQ"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUser = null;
let userOffice = '';
let userCategory = '';
let userDepartment = '';
let createdByDesigneeID = null; // ✅ Store globally for staff case
let currentEditingId = null;
let currentEditingInput = null;

// Reusable function to load current user info (Designee or Staff)
async function getCurrentUserData() {
  currentUser = JSON.parse(localStorage.getItem('userData'));

  if (!currentUser || !currentUser.id) {
    console.log("Session expired. Redirecting...");
    window.location.href = "../../login/designee_login.html";
    throw new Error("User not logged in.");
  }

  try {
    // Check Designees collection first
    const designeeSnap = await db.collection("Designees").doc(currentUser.id).get();
    let userData;

    if (designeeSnap.exists) {
      currentUser.role = "designee";
      userData = designeeSnap.data();
      createdByDesigneeID = currentUser.id; // designees link to themselves
    } else {
      // Query staffTable by field 'id'
      const staffQuery = await db.collection("staffTable").where("id", "==", currentUser.id).get();
      if (staffQuery.empty) throw new Error("User not found in Designees or Staff");

      const staffDoc = staffQuery.docs[0];
      userData = staffDoc.data();

      currentUser.role = "staff";
      createdByDesigneeID = userData.createdByDesigneeID || null; // ✅ staff → store their designee link
    }

    userOffice = (userData.office || "N/A").trim();
    userCategory = (userData.category || "N/A").trim();
    userDepartment = (userData.department || "N/A").trim();

    return true;
  } catch (err) {
    console.error("Failed to get user data:", err);
    alert("Failed to fetch user data.");
    throw err;
  }
}

// Modal Elements
const editModal = document.getElementById("editModal");
const deleteModal = document.getElementById("deleteModal");
const editInput = document.getElementById("editRequirementInput");

// Modal Buttons
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveEditBtn = document.getElementById("saveEditBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

function showModal(modal) {
  modal.style.display = "flex";
}

function closeModal(modal) {
  modal.style.display = "none";
}

document.addEventListener('DOMContentLoaded', async () => {
  // Setup logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function (e) {
      e.preventDefault();

      const keysToRemove = [
        "userData",
        "studentName",
        "schoolID",
        "studentID",
        "staffID",
        "designeeID",
        "category",
        "office",
        "department"
      ];

      keysToRemove.forEach(key => localStorage.removeItem(key));

      window.location.href = "../../logout.html";
    });
  }

  // Dropdown toggle
  const toggle = document.getElementById('userDropdownToggle');
  const menu = document.getElementById('dropdownMenu');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = 'none';
      }
    });
  }

  // Load user data
  try {
    await getCurrentUserData();
  } catch {
    return; // redirect already handled
  }

  // Load requirements
  loadRequirements();

  // Add requirement
  const addBtn = document.getElementById("addRequirementBtn");
  if (addBtn) {
    addBtn.addEventListener("click", async () => {
      const input = document.getElementById("newRequirementInput");
      const requirementText = input.value.trim();

      if (!requirementText) {
        alert("Please enter a requirement.");
        return;
      }

      try {
        await db.collection("RequirementsTable").add({
          requirement: requirementText,
          addedBy: currentUser.id,
          addedByRole: currentUser.role,
          addedByDesigneeId: createdByDesigneeID, // ✅ Always set correctly
          office: userOffice,
          category: userCategory,
          department: userDepartment,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        addRequirementToUI(requirementText);
        input.value = "";
      } catch (error) {
        console.error("Failed to add requirement:", error);
        alert("Could not save requirement. Try again.");
      }
    });
  }
});

async function loadRequirements() {
  try {
    console.log("Loading for:", userOffice, userCategory, userDepartment);

    const snapshot = await db.collection("RequirementsTable")
      .where("office", "==", userOffice)
      .where("category", "==", userCategory)
      .where("department", "==", userDepartment)
      .orderBy("createdAt", "desc")
      .get();

    if (snapshot.empty) {
      console.log("No requirements found.");
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      addRequirementToUI(data.requirement, doc.id);
    });
  } catch (error) {
    console.error("Failed to load requirements:", error);
    alert("Could not load existing requirements.");
  }
}

function addRequirementToUI(requirementText, docId) {
  const list = document.getElementById("requirementsList");

  const row = document.createElement("div");
  row.classList.add("item-row");
  if (docId) row.setAttribute("data-id", docId);

  row.innerHTML = `
    <input type="text" value="${requirementText}" readonly>
    <div class="item-actions">
      <button class="edit-item-btn" title="Edit Requirement"><i class="fas fa-edit"></i></button>
      <button class="delete-item-btn" title="Delete Requirement"><i class="fas fa-trash-alt"></i></button>
    </div>
  `;

  list.prepend(row);

  row.querySelector(".edit-item-btn").addEventListener("click", () => {
    currentEditingId = docId;
    currentEditingInput = row.querySelector("input");
    editInput.value = currentEditingInput.value;
    showModal(editModal);
  });

  row.querySelector(".delete-item-btn").addEventListener("click", () => {
    currentEditingId = docId;
    showModal(deleteModal);
  });
}

saveEditBtn.addEventListener("click", async () => {
  const newText = editInput.value.trim();
  if (!newText) return alert("Requirement cannot be empty.");

  try {
    await db.collection("RequirementsTable").doc(currentEditingId).update({
      requirement: newText
    });
    currentEditingInput.value = newText;
    closeModal(editModal);
    alert("Requirement updated.");
  } catch (err) {
    console.error("Update failed:", err);
    alert("Failed to update.");
  }
});

cancelEditBtn.addEventListener("click", () => {
  closeModal(editModal);
});

confirmDeleteBtn.addEventListener("click", async () => {
  try {
    await db.collection("RequirementsTable").doc(currentEditingId).delete();
    document.querySelector(`[data-id="${currentEditingId}"]`)?.remove();
    closeModal(deleteModal);
    alert("Requirement deleted.");
  } catch (err) {
    console.error("Delete failed:", err);
    alert("Failed to delete.");
  }
});

cancelDeleteBtn.addEventListener("click", () => {
  closeModal(deleteModal);
});
