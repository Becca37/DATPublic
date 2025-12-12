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
                ref = heading.getAttribute( "id" );
            } else {
                var baseId = heading.textContent
                    .trim()
                    .toLowerCase()
                    .replace( /\s+/g, "_" );

                if ( !baseId ) {
                    baseId = "toc_" + sectionIndex + "_" + headingIndex;
                }

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

        const figure = document.createElement( "figure" );
        figure.className = "img-figure";

        img.parentNode.insertBefore( figure, img );
        figure.appendChild( img );

        const caption = document.createElement( "figcaption" );
        caption.className = "img-click-caption";

        const altText = img.alt || "";
        if ( altText ) {
            const altSpan = document.createElement( "span" );
            altSpan.className = "img-caption-alt";
            altSpan.textContent = altText;
            caption.appendChild( altSpan );
        }

        const infoSpan = document.createElement( "span" );
        infoSpan.className = "img-caption-instruction";
        infoSpan.textContent = " Click image to enlarge";
        caption.appendChild( infoSpan );

        figure.appendChild( caption );

        img.dataset.hasCaption = "true";

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

// ---------------------------------------------------------
// Load a CSV and render it into an existing <table> element
// Optionally round numeric values to a fixed number of decimals,
// and append "%" for percent columns.
// ---------------------------------------------------------
function loadCsvIntoTable( csvUrl, tableElementId, options ) {

    const table = document.getElementById( tableElementId );
    if ( !table ) {
        console.warn( "loadCsvIntoTable: No table element found with id:", tableElementId );
        return;
    }

    options = options || {};
    const decimals = (
        typeof options.decimals === "number"
            ? options.decimals
            : null
    );

    const percentColumns = Array.isArray( options.percentColumns )
        ? options.percentColumns.map( function ( name ) {
            return String( name ).toLowerCase();
        } )
        : [ ];

    fetch( csvUrl )
        .then( function ( response ) {
            if ( !response.ok ) {
                throw new Error( "Network response was not ok: " + response.status );
            }
            return response.text();
        } )
        .then( function ( text ) {

            // Simple CSV split: assumes no commas inside fields.
            const rows = text.trim().split( "\n" ).map(
                function ( row ) {
                    return row.split( "," );
                }
            );

            if ( rows.length === 0 ) {
                return;
            }

            const headers = rows[ 0 ];

            while ( table.firstChild ) {
                table.removeChild( table.firstChild );
            }

            rows.forEach( function ( row, rowIndex ) {

                const tr = document.createElement( "tr" );

                row.forEach( function ( cellText, colIndex ) {

                    const isHeader = ( rowIndex === 0 );
                    const cell = document.createElement( isHeader ? "th" : "td" );
                    let displayText = cellText;

                    if ( !isHeader && decimals !== null ) {

                        let trimmed = cellText.trim();
                        trimmed = trimmed.replace( /^"|"$/g, "" );

                        const num = Number( trimmed );

                        if ( !Number.isNaN( num ) ) {
                            displayText = num.toFixed( decimals );

                            const headerName = headers[ colIndex ]
                                ? String( headers[ colIndex ] ).toLowerCase()
                                : "";

                            const isPercentColumn =
                                percentColumns.indexOf( headerName ) !== -1 ||
                                headerName.indexOf( "%" ) !== -1 ||
                                headerName.indexOf( "percent" ) !== -1;

                            if ( isPercentColumn ) {
                                displayText = displayText + "%";
                            }
                        }
                    }

                    cell.textContent = displayText;
                    tr.appendChild( cell );
                } );

                table.appendChild( tr );
            } );
        } )
        .catch( function ( err ) {
            console.error( "Error loading CSV:", err );
        } );
}

// ---------------------------------------------------------
// Wrapper: compute percentColumns from the CSV header row,
// based on "%" or "precent" being in the header text, then call loadCsvIntoTable.
// ---------------------------------------------------------
function loadCsvIntoTableAutoPercent( csvUrl, tableElementId, options ) {

    options = options || {};

    fetch( csvUrl )
        .then( function ( response ) {
            if ( !response.ok ) {
                throw new Error( "Network response was not ok: " + response.status );
            }
            return response.text();
        } )
        .then( function ( text ) {

            const firstLine = ( text.split( /\r?\n/ )[ 0 ] || "" ).trim();
            const headers = firstLine.split( "," ).map( function ( h ) {
                return String( h ).trim();
            } );

           const percentColumns = headers.filter( function ( h ) {

                const lower = String( h ).toLowerCase();

                return (
                    lower.indexOf( "%" ) !== -1 ||
                    lower.indexOf( "percent" ) !== -1
                );

            } );

            const mergedOptions = Object.assign(
                { },
                options,
                { percentColumns: percentColumns }
            );

            loadCsvIntoTable( csvUrl, tableElementId, mergedOptions );

        } )
        .catch( function ( err ) {
            console.error( "Error loading CSV header:", err );
            loadCsvIntoTable( csvUrl, tableElementId, options );
        } );

}

window.addEventListener( "load", myInit, true );

function myInit( ) {  

    htmlTableOfContents();
    addLargerImageLinks();

    loadCsvIntoTable(
        "output/csv/RepeatedWords_Explanation.csv",
        "repeated-words-explanation-table",
        {
            decimals: 1,
            percentColumns: [ "percent_of_filtered_words", "% of Total" ]
        }
    );

    // Crosstabs: percent columns inferred from headers containing "%"
    loadCsvIntoTableAutoPercent(
        "output/csv/Crosstab_Complexity_by_Rating.csv",
        "complexity-by-rating-table",
        { decimals: 1 }
    );

    loadCsvIntoTableAutoPercent(
        "output/csv/Crosstab_Prompt_Category_by_Rating.csv",
        "prompt-category-by-rating-table",
        { decimals: 1 }
    );

}