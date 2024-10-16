document.addEventListener('DOMContentLoaded', function() {
    var menuHtml = `
        <nav>
            <ul>
                <li><a href="https://www.benparry.ca">Home</a></li>
                <li><a href="https://www.benparry.ca/complexity-notebooks">Complexity Notebooks</a></li>
                <li><a href="https://philosophyofprogress.com/">Progress Seminar</a></li>
                <li><a href="https://skillfulnotes.com/">Skillful Notes</a></li>
                <li><a href="https://twitter.com/Via_Benjamin">X (Twitter)</a></li>
            </ul>
        </nav>
    `;
    
    document.getElementById('menu').innerHTML = menuHtml;
});