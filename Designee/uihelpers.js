function generatePassword(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  return Array.from({length}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

function clearModalInputs() {
  ["staffId","firstName","lastName","institutionalEmail","generatedPassword"].forEach(id => {
    document.getElementById(id).value = "";
  });
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

