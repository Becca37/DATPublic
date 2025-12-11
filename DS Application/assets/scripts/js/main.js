

function htmlTableOfContents( ) {
    // Adapted from Source - https://stackoverflow.com/a
    // Posted by Hasse Björk, modified by community. See post 'Timeline' for change history
    // Retrieved 2025-12-08, License - CC BY-SA 4.0

    var toc = document.getElementById( "toc" );
    
    var sections = [].slice.call( document.body.querySelectorAll( "section" ) );
    sections.forEach( function ( section, sectionIndex ) {

        var headings = section ? [].slice.call( section.querySelectorAll( "h1, h2, h3, h4, h5, h6" ) ) : [ ];
        headings.forEach( function ( heading, headingIndex ) {

            var ref;

            if ( heading.hasAttribute( "id" ) ) {
                // Use existing id
                ref = heading.getAttribute( "id" );
            } else {
                // Build id from heading text:
                //  - trim
                //  - lowercase
                //  - replace spaces with underscores
                var baseId = heading.textContent
                    .trim()
                    .toLowerCase()
                    .replace( /\s+/g, "_" );

                // Fallback if heading text is empty
                if ( !baseId ) {
                    baseId = "toc_" + sectionIndex + "_" + headingIndex;
                }

                // Ensure uniqueness (avoid duplicate ids)
                var uniqueId = baseId;
                var counter = 2;
                while ( document.getElementById( uniqueId ) ) {
                    uniqueId = baseId + "_" + counter;
                    counter++;
                }

                heading.setAttribute( "id", uniqueId );
                ref = uniqueId;
            }

            var div = toc.appendChild( document.createElement( "div" ) );
            div.setAttribute( "class", heading.tagName.toLowerCase() );

            var link = div.appendChild( document.createElement( "a" ) );
            link.setAttribute( "href", "#" + ref );
            link.textContent = heading.textContent;
        } );
    } );
}    

// ChatGPT-assisted in script creation
function addLargerImageLinks( ) {

    const images = document.querySelectorAll( ".item-content img" );

    images.forEach( function ( img ) {

        if ( img.dataset.hasCaption ) return;

        // Create wrapper
        const figure = document.createElement( "figure" );
        figure.className = "img-figure";

        // Insert figure before the image, then move img inside
        img.parentNode.insertBefore( figure, img );
        figure.appendChild( img );

        // Create caption
        const caption = document.createElement( "figcaption" );
        caption.className = "img-click-caption";

        // 1) Alt text line (if any)
        const altText = img.alt || "";
        if ( altText ) {
            const altSpan = document.createElement( "span" );
            altSpan.className = "img-caption-alt";
            altSpan.textContent = altText;
            caption.appendChild( altSpan );
        }

        // 2) "Click to enlarge" line
        const infoSpan = document.createElement( "span" );
        infoSpan.className = "img-caption-instruction";
        infoSpan.textContent = " Click image to enlarge";
        caption.appendChild( infoSpan );

        figure.appendChild( caption );

        img.dataset.hasCaption = "true";

        // Click to enlarge behavior
        img.style.cursor = "zoom-in";

        img.addEventListener( "click", function( ) {

            const overlay = document.createElement( "div" );
            overlay.style.position = "fixed";
            overlay.style.top = "0";
            overlay.style.left = "0";
            overlay.style.width = "100%";
            overlay.style.height = "100%";
            overlay.style.backgroundColor = "rgba( 0, 0, 0, 0.8 )";
            overlay.style.display = "flex";
            overlay.style.justifyContent = "center";
            overlay.style.alignItems = "center";
            overlay.style.zIndex = "9999";

            const fullSizeImg = document.createElement( "img" );
            fullSizeImg.src = img.src;
            fullSizeImg.alt = img.alt || "";

            fullSizeImg.style.width = "auto";
            fullSizeImg.style.height = "auto";
            fullSizeImg.style.maxWidth = "90vw";
            fullSizeImg.style.maxHeight = "90vh";
            fullSizeImg.style.objectFit = "contain";

            overlay.appendChild( fullSizeImg );
            document.body.appendChild( overlay );

            overlay.addEventListener( "click", function( ) {
                document.body.removeChild( overlay );
            } );
        } );
    } );
}

// ChatGPT-assisted in script creation
// ---------------------------------------------------------
// Load a CSV and render it into an existing <table> element
// Optionally round numeric values to a fixed number of decimals.
// ---------------------------------------------------------
function loadCsvIntoTable( csvUrl, tableElementId, options ) {

    const table = document.getElementById( tableElementId );
    if ( !table ) {
        console.warn( "loadCsvIntoTable: No table element found with id:", tableElementId );
        return;
    }

    // options: { decimals: 1 }
    options = options || {};
    const decimals = (
        typeof options.decimals === "number"
            ? options.decimals
            : null
    );

    fetch( csvUrl )
        .then( function( response ) {
            if ( !response.ok ) {
                throw new Error( "Network response was not ok: " + response.status );
            }
            return response.text();
        } )
        .then( function( text ) {

            // Simple CSV split: assumes no commas inside fields.
            const rows = text.trim().split( "\n" ).map(
                function( row ) {
                    return row.split( "," );
                }
            );

            // Clear any existing table content
            while ( table.firstChild ) {
                table.removeChild( table.firstChild );
            }

            rows.forEach( function( row, rowIndex ) {

                const tr = document.createElement( "tr" );

                row.forEach( function( cellText, colIndex ) {

                    const cell = document.createElement( rowIndex === 0 ? "th" : "td" );
                    let displayText = cellText;

                    // Only try to round on non-header rows and if decimals is set
                    if ( rowIndex !== 0 && decimals !== null ) {
                        // Trim whitespace
                        const trimmed = cellText.trim();

                        // Simple "is this a number?" check:
                        // matches optional sign, digits, optional decimal part
                        const numericPattern = /^-?\d+(\.\d+)?$/;

                        if ( numericPattern.test( trimmed ) ) {
                            const num = Number( trimmed );
                            if ( !Number.isNaN( num ) ) {
                                displayText = num.toFixed( decimals );
                            }
                        }
                    }

                    cell.textContent = displayText;
                    tr.appendChild( cell );
                } );

                table.appendChild( tr );
            } );
        } )
        .catch( function( err ) {
            console.error( "Error loading CSV:", err );
        } );
}

window.addEventListener("load", myInit, true); function myInit(){  
    htmlTableOfContents();
    addLargerImageLinks();
    loadCsvIntoTable(
        "assets/csv/RepeatedWords_Explanation.csv",
        "repeated-words-explanation-table", 
        { decimals: 1 } 
    );
};   