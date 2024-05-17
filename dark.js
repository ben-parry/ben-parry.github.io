const darkModeImage = document.querySelector('#darkModeToggle');
const htmlBody = document.querySelector('body');

darkModeImage.addEventListener('click', () => {
  htmlBody.classList.toggle('dark-mode');
});