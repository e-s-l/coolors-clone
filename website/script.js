/**
 * FIXME
 * numberOfLockedBoxes maybe not updating or something???
 * Min box Count number getting stuck...
 */



const dataFile = "colours.json";        // really this should be an endpoint

document.addEventListener("DOMContentLoaded", async () => {

    // let palette = [];

    // let storedPalette = sessionStorage.getItem("palette");
    // let palette = storedPalette ? JSON.parse(storedPalette) : [];

    // palette = palette.map(b => {
    //     let box = new ColourBox(b.colour);
    //     box.locked = b.locked;
    //     return box;
    // });

    let stored = sessionStorage.getItem("palette");

    let palette = [];

    if (stored) {
        try {
            const parsed = JSON.parse(stored);

            palette = parsed.map(b => {
                const box = new ColourBox(b.colour);
                box.locked = b.locked;
                return box;
            });
        } catch (err) {
            console.warn("Failed to parse stored palette, resetting:", err);
            palette = [];
            sessionStorage.removeItem("palette");
        }
    }

    let colours = null;
    let storedColours = sessionStorage.getItem("colours");

    if (storedColours) {
        colours = JSON.parse(storedColours);
    }
    else {
        colours = await fetchColours(dataFile);
        // and save
        sessionStorage.setItem("colours", JSON.stringify(colours));
    }

    if (!colours) {
        return;
    }

    /**
     * get UI controls
     */
    const regenButton = document.getElementById("regenerate");
    const boxInput = document.getElementById("box-count");

    // in case we pulled a stored palette...
    if (palette.length > 0) {
        console.log(`restoring number of boxes to ${palette.length}`);
        boxInput.value = palette.length
    }

    const formatSelect = document.getElementById("format-select");
    const getCssButton = document.getElementById("get-css-btn");

    // handle the popup box
    const infoButton = document.getElementById("info");
    const popup = document.getElementById("info-popup");
    const popupCloseBtn = popup.querySelector(".close-btn");

    infoButton.addEventListener("click", () => {
        popup.classList.toggle("no-show");
    });

    popupCloseBtn.addEventListener("click", () => {
        popup.classList.add("no-show");
    });

    popup.addEventListener("click", (e) => {
        if (e.target === popup) {
            popup.classList.add("no-show");
        }
    });


    /**
     * generate
     */

    function generateOutput() {

        // handle the getting of the number of boxes
        let boxNum = parseInt(boxInput.value);
        let boxMin = Math.max(parseInt(boxInput.min), getNumberOfLockedBoxes(palette));
        let boxMax = parseInt(boxInput.max);
        boxNum = Math.max(boxMin,
            Math.min(boxMax, boxNum));

        boxInput.value = boxNum;

        if (boxNum < boxMin) {
            boxInput.value = boxMin;
        }

        // actually make and show
        palette = fillPalette(palette, boxNum, colours);
        renderPalette(palette, formatSelect.value);
    }

    generateOutput();

    /**
     * regenerate
     */

    // on change to the box count control
    boxInput.addEventListener("input", generateOutput);

    // on click of the button
    regenButton.addEventListener("click", () => {
        generateOutput();
    });

    // on press of spacebar
    document.addEventListener("keydown", (e) => {
        if (e.code === "Space") {
            e.preventDefault();
            generateOutput();
        }
    });

    // half refresh on selection of hex or rgb
    formatSelect.addEventListener("change", () => {
        renderPalette(palette, formatSelect.value);
    });

    // copy the current values to the clipboard
    getCssButton.addEventListener("click", () => {
        navigator.clipboard.writeText(getPaletteCss(palette, formatSelect.value))
            .then(() => console.log("Palette CSS copied to clipboard!"))
            .catch(err => console.error("Could not copy CSS: ", err));
    });
});

/***********
 * methods *
 ***********/

class ColourBox {
    constructor(colour) {
        this.colour = colour;   // where colour = { name, hex }
        this.locked = false;
    }
}

/*************
 * functions *
 *************/

async function fetchColours(jsonData) {

    console.log("fetching available colours");

    try {
        const res = await fetch(jsonData);

        if (!res.ok) {
            throw new Error(`HTTP error ${res.status}`);
        }

        return await res.json();

    } catch (err) {
        console.error("Failed to fetch colours:", err);
        return null;
    }
}

function renderPalette(palette, displayFormat) {

    const lockSym = `<span class="material-symbols-outlined">lock_open_right</span>`;
    const unlockSym = `<span class="material-symbols-outlined">lock</span>`;
    const leftArrow = `<span class="material-symbols-outlined">arrow_left</span>`;
    const rightArrow = `<span class="material-symbols-outlined">arrow_right</span>`;

    let container = document.getElementById("output-container");

    container.innerHTML = "";                   // this is silly

    palette.forEach((box, index) => {
        let div = document.createElement("div");
        let c = box.colour;

        div.className = "colour-box";

        div.style.backgroundColor = c.hex;
        // console.log(box.colour);
        div.style.color = setBoxTextColour(c.hex);

        const displayCode = displayFormat === "hex" ? c.hex : hex2Rgb(c.hex, true);

        div.title = `${c.name}: ${displayCode}`;
        div.innerHTML = `
            <span class="box-label">
                <p class="c-name">${c.name}</p>
                <button class="lock-btn">
                    ${box.locked ? unlockSym : lockSym}
                </button>
                <div class="order-btns">
                    <button class="move-left">${leftArrow}</button>
                    <button class="move-right">${rightArrow}</button>
                </div>
            </span>
            <span class="colour-label">
                <p>${displayCode}</p>
            </span>
        `;

        const btn = div.querySelector(".lock-btn");

        btn.addEventListener("click", () => {
            box.locked = !box.locked;
            btn.innerHTML = box.locked ? unlockSym : lockSym;
        });

        const btnLeft = div.querySelector(".move-left");
        const btnRight = div.querySelector(".move-right");

        if (index === 0) {
            btnLeft.setAttribute("disabled", "");
        }
        else if (index === palette.length - 1) {
            btnRight.setAttribute("disabled", "");
        }

        btnLeft.addEventListener("click", () => {
            if (index > 0) {
                [palette[index - 1], palette[index]] = [palette[index], palette[index - 1]];
                renderPalette(palette, displayFormat);
            }
        });

        btnRight.addEventListener("click", () => {
            if (index < palette.length - 1) {
                [palette[index], palette[index + 1]] = [palette[index + 1], palette[index]];
                renderPalette(palette, displayFormat);
            }
        });

        container.appendChild(div);
    });

    sessionStorage.setItem("palette", JSON.stringify(palette));
}


function setBoxTextColour(hex) {

    const [r, g, b] = hex2Rgb(hex, false);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);

    return luminance > 100 ? "black" : "white";
}

function hex2Rgb(hex, asString) {
    // we always assume long-form hex strings
    // returns absolute rgb as array or string: "x,y,z"

    // strip #
    hex = hex.replace(/^#/, "");

    // calculate r,g,b
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    if (asString) {
        return `${r}, ${g}, ${b}`;
    }
    else {
        // as array
        return [r, g, b]
    }
}

function fillPalette(palette, boxNum, colours) {

    const lockedBoxes = palette.filter(b => b.locked);
    boxNum = Math.max(boxNum, lockedBoxes.length);

    /**
     * push or pop unto pallete stack until correct amount
     */

    while (palette.length > boxNum) {

        let idx = palette.length - 1;

        while (idx >= 0 && palette[idx].locked) {
            idx--;
        }

        if (idx >= 0) {
            palette.splice(idx, 1);
        } else {
            break;
        }
    }

    while (palette.length < boxNum) {
        const c = colours[Math.floor(Math.random() * colours.length)];
        palette.push(new ColourBox(c));
    }

    // randomly set the box colours (if not locked)

    palette.forEach(box => {
        if (!box.locked) {
            const c = colours[Math.floor(Math.random() * colours.length)];
            box.colour = c;
        }
    });

    return palette;
}

function getNumberOfLockedBoxes(palette) {

    let numberOfLockedBoxes = 0;

    palette.forEach(box => {
        if (box.locked) {
            numberOfLockedBoxes++;
        }
    });

    console.log(`Locked Box Count = ${numberOfLockedBoxes}`);

    return numberOfLockedBoxes;
}


/**
 * 
 * @param {*} palette 
 * @param {String} displayFormat 
 * @returns {String}
 */
function getPaletteCss(palette, displayFormat) {

    let css = `/*** as ${displayFormat} codes ***/`
    css += ":root {\n";
    palette.forEach((b, i) => {
        if (displayFormat === "hex") {
            css += `  --color-${i + 1}: ${b.colour.hex};\n`;
        }
        else {
            css += `  --color-${i + 1}: rgb(${hex2Rgb(b.colour.hex, true)});\n`;
        }
    });
    css += "}\n";
    css += "/*** as html colour names ***/"
    css += ":root {\n";
    palette.forEach((b, i) => {
        css += `  --color-${i + 1}: ${b.colour.name.toLowerCase()};\n`;
    });
    css += "}\n";

    return css;
}
