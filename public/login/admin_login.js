document.getElementById("registrationForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const adminID = document.getElementById("adminID").value.trim();
  const password = document.getElementById("password").value.trim();
  const messageBox = document.getElementById("messageBox");

  // Reset message box
  messageBox.style.display = "none";
  messageBox.textContent = "";

  console.log("Input Admin ID:", adminID);
  console.log("Input Password:", password);

  try {
    // ✅ Access the document path: User -> Admin
    const docRef = db.collection("User").doc("Admin");
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      console.log("Firestore Data:", data);

      // ✅ Compare user input with Firestore fields
      if (data.adminID === adminID && data.password === password) {
        // Store adminID in localStorage
        localStorage.setItem("adminID", adminID);

        // Success message
        messageBox.style.display = "block";
        messageBox.style.color = "green";
        messageBox.textContent = "Login successful!";

        // Redirect after short delay
        setTimeout(() => {
          window.location.href = "../admin/admin.html";
        }, 1000);
      } else {
        // Invalid credentials
        messageBox.style.display = "block";
        messageBox.style.color = "red";
        messageBox.textContent = "Invalid Admin ID or password.";
      }
    } else {
      // Document not found
      messageBox.style.display = "block";
      messageBox.style.color = "red";
      messageBox.textContent = "Admin document not found.";
    }
  } catch (error) {
    console.error("Login error:", error);
    messageBox.style.display = "block";
    messageBox.style.color = "red";
    messageBox.textContent = "Something went wrong. Try again.";
  }
});
