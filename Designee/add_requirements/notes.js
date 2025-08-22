// Assumes Firebase app is initialized and firestore is assigned to `db`
// Also assumes user session variables/functions:
//   - currentUser (with .id)
//   - userOffice, userCategory, userDepartment
//   - getCurrentUserData() loads those values and currentUser

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const notesContent = document.getElementById("notesContent");
  const editBtn = document.getElementById("editNotesBtn");
  const saveBtn = document.getElementById("saveNotesBtn");
  const cancelBtn = document.getElementById("cancelNotesBtn");
  const charCountDisplay = document.getElementById("noteCharCount");

  // State vars
  let originalNotes = "";
  let existingDocId = null;

  // Utility: Place caret at end of contenteditable div
  function placeCaretAtEnd(el) {
    el.focus();
    if (typeof window.getSelection !== "undefined"
      && typeof document.createRange !== "undefined") {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  // Initial UI state
  notesContent.contentEditable = false;
  saveBtn.style.display = "none";
  cancelBtn.style.display = "none";
  editBtn.style.display = "inline-block";

  // Load user data and fetch note
  try {
    await getCurrentUserData();

    // Check db and currentUser exist
    if (!db) throw new Error("Firestore (db) not initialized.");
    if (!currentUser || !currentUser.id) throw new Error("User not logged in.");

    // Normalize filters — remove .toLowerCase() to match Firestore case exactly
    const normalizedOffice = (userOffice || "").trim();
    const normalizedCategory = (userCategory || "").trim();
    const normalizedDepartment = (userDepartment || "").trim();

    console.log("Loading notes for:", {
      office: normalizedOffice,
      category: normalizedCategory,
      department: normalizedDepartment,
    });

    // Query Firestore for latest note matching filters
    const querySnapshot = await db.collection("notesTable")
      .where("office", "==", normalizedOffice)
      .where("category", "==", normalizedCategory)
      .where("department", "==", normalizedDepartment)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (!querySnapshot.empty) {
      const noteDoc = querySnapshot.docs[0];
      const noteData = noteDoc.data();

      existingDocId = noteDoc.id;
      originalNotes = noteData.note || "";
      notesContent.innerText = originalNotes;
      charCountDisplay.innerText = `${originalNotes.length} / 150`;
      // Remove placeholder attribute if present
      notesContent.removeAttribute("data-placeholder");
    } else {
      // No note found - show empty editable area with placeholder styling
      existingDocId = null;
      originalNotes = "";
      notesContent.innerText = "";
      charCountDisplay.innerText = `0 / 150`;
      notesContent.setAttribute("data-placeholder", "No note yet. Click Edit to add.");
    }
  } catch (error) {
    console.error("Error loading note:", error);
    notesContent.innerText = "Failed to load note.";
    notesContent.contentEditable = false;
    editBtn.disabled = true;
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    charCountDisplay.innerText = "0 / 150";
    return;
  }

  // Character counter and enforce max length 150
  notesContent.addEventListener("input", () => {
    let text = notesContent.innerText;
    if (text.length > 150) {
      notesContent.innerText = text.substring(0, 150);
      placeCaretAtEnd(notesContent);
      text = notesContent.innerText;
    }
    charCountDisplay.innerText = `${text.length} / 150`;
  });

  // Edit button click: enable editing
  editBtn.addEventListener("click", () => {
    originalNotes = notesContent.innerText.trim();
    if (originalNotes === "No note yet." || originalNotes === "") {
      notesContent.innerText = ""; // Clear placeholder for fresh note
    }
    notesContent.contentEditable = true;
    notesContent.focus();
    placeCaretAtEnd(notesContent);

    saveBtn.style.display = "inline-block";
    cancelBtn.style.display = "inline-block";
    editBtn.style.display = "none";

    // Remove placeholder attribute if present
    notesContent.removeAttribute("data-placeholder");
  });

  // Cancel button: revert changes
  cancelBtn.addEventListener("click", () => {
    notesContent.innerText = originalNotes;
    notesContent.contentEditable = false;
    saveBtn.style.display = "none";
    cancelBtn.style.display = "none";
    editBtn.style.display = "inline-block";
    charCountDisplay.innerText = `${originalNotes.length} / 150`;

    // If note empty, restore placeholder
    if (!originalNotes) {
      notesContent.setAttribute("data-placeholder", "No note yet. Click Edit to add.");
    }
  });

  // Save button: save or update Firestore document
  saveBtn.addEventListener("click", async () => {
    const noteText = notesContent.innerText.trim();

    if (noteText.length > 150) {
      alert(`Note cannot exceed 150 characters.\nCurrent length: ${noteText.length}`);
      return;
    }

    if (!noteText) {
      alert("Note cannot be empty.");
      return;
    }

    try {
      // Normalize again before saving — no toLowerCase()
      const normalizedOffice = (userOffice || "").trim();
      const normalizedCategory = (userCategory || "").trim();
      const normalizedDepartment = (userDepartment || "").trim();

      if (existingDocId) {
        // Update existing note
        await db.collection("notesTable").doc(existingDocId).update({
          note: noteText,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        alert("Note updated successfully.");
      } else {
        // Create new note document
        const docRef = await db.collection("notesTable").add({
          note: noteText,
          addedBy: currentUser.id,
          office: normalizedOffice,
          category: normalizedCategory,
          department: normalizedDepartment,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        existingDocId = docRef.id;
        alert("Note created successfully.");
      }

      originalNotes = noteText;
      notesContent.contentEditable = false;
      saveBtn.style.display = "none";
      cancelBtn.style.display = "none";
      editBtn.style.display = "inline-block";
      charCountDisplay.innerText = `${noteText.length} / 150`;
    } catch (error) {
      console.error("Failed to save note:", error);
      alert("Failed to save note.");
    }
  });
});
