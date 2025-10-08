document.addEventListener('DOMContentLoaded', async () => {
  // --- Firebase Config ---
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

  // --- DOM Elements ---
  const registrationForm = document.getElementById('registrationForm');
  const officeSelect = document.getElementById('office');
  const categoryGroup = document.getElementById('categoryGroup');
  const categorySelect = document.getElementById('category');
  const departmentGroup = document.getElementById('departmentGroup');
  const departmentSelect = document.getElementById('department');
  const messageBox = document.getElementById('messageBox');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');

  // --- Firestore References ---
  const officeRef = db.collection("DataTable").doc("Office").collection("OfficeDocs");
  const departmentRef = db.collection("DataTable").doc("Department").collection("DepartmentDocs");
  const clubRef = db.collection("DataTable").doc("Clubs").collection("ClubsDocs");
  const pendingDesigneeRef = db.collection("User").doc("PendingDesignees").collection("PendingDocs");
  const approvedDesigneeRef = db.collection("User").doc("Designees").collection("DesigneeDocs"); // optional: check approved users

  // --- Load Offices ---
  const officeSnapshot = await officeRef.get();
  officeSnapshot.forEach(doc => {
    const data = doc.data();
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = data.office || data.officeName || `Office ${doc.id}`;
    officeSelect.appendChild(option);
  });

  // --- Load Departments ---
  const deptSnapshot = await departmentRef.get();
  const departments = deptSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  departmentSelect.innerHTML = `
    <option value="">Select Department</option>
    ${departments.map(d => `<option value="${d.code}">${d.code}</option>`).join('')}
  `;

  // --- Office IDs ---
  const clubOfficeIDs = ["1", "13", "14", "15", "16"]; // show clubs
  const deptOfficeIDs = ["4", "7", "11"];             // show department

  // --- Office Change Logic ---
  officeSelect.addEventListener('change', async () => {
    const selectedOfficeID = officeSelect.value;

    // Reset displays
    categoryGroup.style.display = 'none';
    departmentGroup.style.display = 'none';
    categorySelect.innerHTML = '<option value="">Select Category</option>';

    // --- Show Clubs Category (Offices 1, 13, 14, 15, 16) ---
    if (clubOfficeIDs.includes(selectedOfficeID)) {
        categoryGroup.style.display = 'block';
        categorySelect.innerHTML = '<option value="">Loading...</option>';

        try {
            const clubsSnapshot = await clubRef.where("officeType", "==", selectedOfficeID).get();
            if (!clubsSnapshot.empty) {
                let options = '<option value="">Select Category</option>';
                clubsSnapshot.forEach(doc => {
                    const data = doc.data();
                    options += `<option value="${doc.id}">${data.code || doc.id}</option>`;
                });
                categorySelect.innerHTML = options;
            } else {
                categorySelect.innerHTML = '<option value="">No categories available</option>';
            }
        } catch (err) {
            console.error("Error loading clubs:", err);
            categorySelect.innerHTML = '<option value="">Error loading categories</option>';
        }
    }

    // --- Show Department (Offices 4,7,11) ---
    if (deptOfficeIDs.includes(selectedOfficeID)) {
        departmentGroup.style.display = 'block';
    }

    // --- Show Labs Category (Office 8) ---
    if (selectedOfficeID === "8") {
        categoryGroup.style.display = 'block';
        categorySelect.innerHTML = '<option value="">Loading...</option>';

        try {
            const labsRef = db.collection("DataTable").doc("Lab").collection("LabDocs");
            const labsSnapshot = await labsRef.get();
            if (!labsSnapshot.empty) {
                let options = '<option value="">Select Lab</option>';
                labsSnapshot.forEach(doc => {
                    const data = doc.data();
                    options += `<option value="${doc.id}">${data.lab || doc.id}</option>`;
                });
                categorySelect.innerHTML = options;
            } else {
                categorySelect.innerHTML = '<option value="">No labs available</option>';
            }
        } catch (err) {
            console.error("Error loading labs:", err);
            categorySelect.innerHTML = '<option value="">Error loading labs</option>';
        }
    }
  });

  // --- Helper: Show Message ---
  function showMessage(message, type = 'error') {
    messageBox.textContent = message;
    messageBox.style.display = 'block';
    if (type === 'error') {
      messageBox.style.backgroundColor = '#ffe0b2';
      messageBox.style.color = '#e65100';
      messageBox.style.borderColor = '#ffab40';
    } else if (type === 'success') {
      messageBox.style.backgroundColor = '#d4edda';
      messageBox.style.color = '#155724';
      messageBox.style.borderColor = '#28a745';
    }
  }

  function hideMessageBox() {
    messageBox.style.display = 'none';
    messageBox.textContent = '';
  }

  // --- Password Validation (DISABLED for testing) ---
  const isPasswordValid = (password) => {
    // Commented out strict password rules for testing
    // const regex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    // return regex.test(password);
    return true; // allow any password for now
  };

  // --- Form Submit ---
  registrationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessageBox();

    const userID = document.getElementById('userID').value.trim();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const officeID = officeSelect.value;
    const categoryID = categorySelect.value;
    const departmentCode = departmentSelect.value;
    const institutionalEmail = document.getElementById('institutionalEmail').value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // --- Validation ---
    if (!userID || !officeID || !institutionalEmail || !password || !confirmPassword) {
      showMessage('Please fill in all required fields.');
      return;
    }

    if (categoryGroup.style.display === 'block' && !categoryID) {
      showMessage('Please select a category.');
      return;
    }

    if (departmentGroup.style.display === 'block' && !departmentCode) {
      showMessage('Please select a department.');
      return;
    }

    if (password !== confirmPassword) {
      showMessage('Passwords do not match.');
      passwordInput.value = '';
      confirmPasswordInput.value = '';
      passwordInput.focus();
      return;
    }

    if (!isPasswordValid(password)) {
      showMessage('Password validation is disabled for testing.');
      passwordInput.value = '';
      confirmPasswordInput.value = '';
      passwordInput.focus();
      return;
    }

    try {
      // --- Check if userID already exists in PendingDesignees ---
      const existingPendingSnap = await pendingDesigneeRef.where("userID", "==", userID).limit(1).get();
      if (!existingPendingSnap.empty) {
        showMessage("This User ID is already registered. Please use a different one.");
        return;
      }

      // --- Optional: Check approved designees too ---
      const existingApprovedSnap = await approvedDesigneeRef.where("userID", "==", userID).limit(1).get();
      if (!existingApprovedSnap.empty) {
        showMessage("This User ID is already registered and approved. Please use a different one.");
        return;
      }

      // --- Find Department ID ---
      let departmentID = "";
      if (departmentCode) {
        const deptSnap = await departmentRef.where("code", "==", departmentCode).limit(1).get();
        if (!deptSnap.empty) departmentID = deptSnap.docs[0].id;
      }

      // --- Compose Document ID ---
      let docID = userID + "-" + officeID;
      if (departmentID) docID += `-${departmentID}`;
      if (categoryID) docID += `-${categoryID}`;

      const pendingDesigneeData = {
        userID,
        firstName,
        lastName,
        office: officeID,
        category: categoryID || '',
        department: departmentID || '',
        institutionalEmail,
        password,   // ⚠️ hash in production
        role: "Designee",
        status: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      // --- Save to PendingDesignees ---
      await pendingDesigneeRef.doc(docID).set(pendingDesigneeData);

      showMessage("Registration submitted successfully! Pending approval.", 'success');
      registrationForm.reset();
      categoryGroup.style.display = 'none';
      departmentGroup.style.display = 'none';

      setTimeout(() => {
        window.location.href = "../login/designee_login.html";
      }, 1500);

    } catch (err) {
      console.error("Error saving pending designee:", err);
      showMessage("Failed to submit registration. Try again.");
    }
  });
});
