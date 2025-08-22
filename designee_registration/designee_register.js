document.addEventListener('DOMContentLoaded', async () => {
  // Firebase Configuration
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

  const registrationForm = document.getElementById('registrationForm');
  const officeSelect = document.getElementById('office');
  const categoryGroup = document.getElementById('categoryGroup');
  const categorySelect = document.getElementById('category');
  const departmentGroup = document.getElementById('departmentGroup');
  const departmentSelect = document.getElementById('department');
  const messageBox = document.getElementById('messageBox');

  // Load offices from Firestore (officeTable)
  const officeSnapshot = await db.collection("officeTable").get();
  officeSnapshot.forEach(doc => {
    const data = doc.data();
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = data.office;
    officeSelect.appendChild(option);
  });

  // Load departments from departmentTable
  const departments = [];
  const deptSnapshot = await db.collection("departmentTable").get();
  deptSnapshot.forEach(doc => {
    const data = doc.data();
    departments.push(data.code);
  });
  departmentSelect.innerHTML = '<option value="">Select Department</option>' +
    departments.map(dept => `<option value="${dept}">${dept}</option>`).join("");

  // Office change logic
  officeSelect.addEventListener('change', async () => {
    const officeID = officeSelect.value;
    categoryGroup.style.display = 'none';
    departmentGroup.style.display = 'none';
    categorySelect.innerHTML = '<option value="">Select Category</option>';

    if (["301", "310", "311", "312", "313"].includes(officeID)) {
      // Academic clubs (groupTable)
      categoryGroup.style.display = 'block';
      const groupSnapshot = await db.collection("groupTable").get();
      const selectedOfficeName = officeSelect.options[officeSelect.selectedIndex].textContent;
      const filteredClubs = groupSnapshot.docs
        .filter(doc => doc.data().codeName === selectedOfficeName)
        .map(doc => doc.data().club);
      categorySelect.innerHTML += filteredClubs
        .map(club => `<option value="${club}">${club}</option>`)
        .join("");

    } else if (["307", "308"].includes(officeID)) {
      // Department only
      departmentGroup.style.display = 'block';

    } else if (officeID === "309") {
      // Academic clubs by department
      departmentGroup.style.display = 'block';
      departmentSelect.addEventListener('change', async () => {
        categoryGroup.style.display = 'block';
        const selectedDept = departmentSelect.value;
        const acadClubs = await db.collection("acadClubTable")
          .where("deptCode", "==", selectedDept).get();
        categorySelect.innerHTML = '<option value="">Select Category</option>';
        acadClubs.forEach(doc => {
          categorySelect.innerHTML += `<option value="${doc.data().club}">${doc.data().club}</option>`;
        });
      });

    } else if (officeID === "314") {
      // Laboratories (labTable)
      categoryGroup.style.display = 'block';
      const labSnapshot = await db.collection("labTable").get();
      labSnapshot.forEach(doc => {
        categorySelect.innerHTML += `<option value="${doc.data().lab}">${doc.data().lab}</option>`;
      });
    }
  });

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

  registrationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessageBox();

    const userID = document.getElementById('userID').value.trim();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const officeName = officeSelect.options[officeSelect.selectedIndex].textContent;
    const categoryName = categorySelect.value;
    const departmentCode = departmentSelect.value;
    const institutionalEmail = document.getElementById('institutionalEmail').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!userID || !officeSelect.value || !institutionalEmail || !password || !confirmPassword) {
      showMessage('Please fill in all required fields.');
      return;
    }

    if (categoryGroup.style.display === 'block' && !categoryName) {
      showMessage('Please select a category.');
      return;
    }

    if (departmentGroup.style.display === 'block' && !departmentCode) {
      showMessage('Please select a department.');
      return;
    }

    if (password.length < 6) {
      showMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      showMessage('Passwords do not match.');
      return;
    }

    try {
      const officeID = officeSelect.value;
      let departmentID = "";
      if (departmentGroup.style.display === 'block') {
        const deptSnap = await db.collection("departmentTable")
          .where("code", "==", departmentCode)
          .limit(1)
          .get();
        if (!deptSnap.empty) {
          departmentID = deptSnap.docs[0].id;
        }
      }

      let categoryID = "";
      if (categoryGroup.style.display === 'block') {
        let categoryCollection = "";

        if (["301", "310", "311", "312", "313"].includes(officeID)) {
          categoryCollection = "groupTable";
        } else if (officeID === "309") {
          categoryCollection = "acadClubTable";
        } else if (officeID === "314") {
          categoryCollection = "labTable";
        }

        if (categoryCollection) {
          const catSnap = await db.collection(categoryCollection)
            .where(categoryCollection === "labTable" ? "lab" : "club", "==", categoryName)
            .limit(1)
            .get();
          if (!catSnap.empty) {
            categoryID = catSnap.docs[0].id;
          }
        }
      }

      const designeeData = {
        userID,
        firstName,
        lastName,
        office: officeID,
        category: categoryID || '',
        department: departmentID || '',
        institutionalEmail,
        password
      };

      await db.collection("Designees").doc(userID).set(designeeData);
      showMessage("Registration successful!", 'success');
      registrationForm.reset();
      categoryGroup.style.display = 'none';
      departmentGroup.style.display = 'none';

      setTimeout(() => {
        window.location.href = "../Designee/designee.html";
      }, 1500);

    } catch (err) {
      console.error("Error saving designee:", err);
      showMessage("Failed to register. Try again.");
    }
  });

});
