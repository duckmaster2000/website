let gem = document.querySelector('.gem-cost');
let parsedgem = parseFloat(gem.innerHTML);

let clickerCost = document.querySelector('.clicker-cost')
let parsedClickerCost = parseFloat(clickerCost.innerHTML);
let clickerLevel = document.querySelector('.clickerLevel');
let clickerIncrease = document.querySelector('.clickerIncrease');
let parsedClickerIncrease = parseFloat(clickerIncrease.innerHTML);

let gpc = 1;

function incrementGem() {
    gem.innerHTML = Math.round(parsedgem += gpc);
}

function buyClicker() {
    if (parsedgem >= parsedClickerCost) {
        gem.innerHTML = Math.round(parsedgem -= parsedClickerCost);

        clickerLevel.innerHTML++;

        parsedClickerIncrease = parseFloat((parsedClickerIncrease * 1.03).toFixed(2));
        clickerIncrease.innerHTML = parsedClickerIncrease;
        gpc += parsedClickerIncrease;

        parsedClickerCost *= 1.18;
        clickerCost.innerHTML = Math.round(parsedClickerCost);
    }
}
