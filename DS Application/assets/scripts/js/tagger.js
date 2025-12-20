/* Tagging UI logic */

const state = {
   allRecords: [ ],
   records: [ ],
   current: 0,
   filterUntagged: false,
   categoryFilter: "all",
   tagFilter: "all",
   suggestions: [ ],
   tagStats: [ ],
   currentTags: {
      chatgpt: [ ],
      bard: [ ],
   },
};

function qs( sel ) {
   return document.querySelector( sel );
}

function renderRecord( ) {
   const rec = state.records[ state.current ];
   const ratingEl = qs( "#rating" );
   const promptCatEl = qs( "#prompt_category" );
   const promptEl = qs( "#prompt" );
   const chatgptEl = qs( "#chatgpt_response" );
   const bardEl = qs( "#bard_response" );
   const explanationEl = qs( "#explanation" );
   const chatgptInput = qs( "#tags_chatgpt_input" );
   const bardInput = qs( "#tags_bard_input" );
   const status = qs( "#status" );
   const idEl = qs( "#record_id" );

   if ( !rec ) {
      if ( ratingEl ) ratingEl.textContent = "No record";
      if ( promptCatEl ) promptCatEl.textContent = "";
      if ( promptEl ) promptEl.textContent = "";
      if ( chatgptEl ) chatgptEl.textContent = "";
      if ( bardEl ) bardEl.textContent = "";
      if ( explanationEl ) explanationEl.textContent = "";
      if ( chatgptInput ) chatgptInput.value = "";
      if ( bardInput ) bardInput.value = "";
      if ( status ) status.textContent = "No records found";
      return;
   }

   if ( ratingEl ) ratingEl.textContent = rec.rating || "-";
   if ( idEl ) idEl.textContent = rec.id != null ? `ID ${rec.id}` : "ID";
   if ( promptCatEl ) promptCatEl.textContent = rec.prompt_category || "";
   if ( promptEl ) promptEl.textContent = rec.prompt || "";
   if ( chatgptEl ) chatgptEl.textContent = rec.chatgpt || "";
   if ( bardEl ) bardEl.textContent = rec.bard || "";
   if ( explanationEl ) explanationEl.textContent = rec.explanation || "(no explanation)";
   if ( chatgptInput ) chatgptInput.value = "";
   if ( bardInput ) bardInput.value = "";

   state.currentTags.chatgpt = parseTags( rec.tags_chatgpt );
   state.currentTags.bard = parseTags( rec.tags_bard );

   if ( status ) {
      var taggedCount = state.records.filter( function ( r ) {
         return ( r.tags_chatgpt && r.tags_chatgpt.trim().length ) || ( r.tags_bard && r.tags_bard.trim().length );
      } ).length;
      var untaggedCount = state.records.length - taggedCount;
      status.textContent = `Record ${state.current + 1} of ${state.records.length} (${untaggedCount} untagged / ${taggedCount} tagged)`;
   }

   renderSuggestions( state.suggestions, "#suggest_chatgpt", "chatgpt" );
   renderSuggestions( state.suggestions, "#suggest_bard", "bard" );
   renderCurrentTags( state.currentTags.chatgpt, "#current_chatgpt", "chatgpt" );
   renderCurrentTags( state.currentTags.bard, "#current_bard", "bard" );
   renderTagPickers( );
   renderAvailableTags( );
   updateMissingButton( );

   setIdInUrl( rec.id );
   updateNavButtons( );
}

function saveTags( advance ) {
   const rec = state.records[ state.current ];
   if ( !rec ) return;

   addTagsFromInput( "chatgpt" );
   addTagsFromInput( "bard" );

   const status = qs( "#status" );
   const payload = {
      tags_chatgpt: state.currentTags.chatgpt.join( ", " ),
      tags_bard: state.currentTags.bard.join( ", " ),
   };

   if ( status ) status.textContent = "Saving...";

   fetch( `/api/explanations/${rec.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify( payload ),
   } )
      .then( function ( res ) {
         if ( !res.ok ) {
            throw new Error( `Save failed (${res.status})` );
         }
         // some endpoints return 204; don't try to parse JSON when there's no body
         if ( res.status === 204 ) return null;
         if ( res.headers && res.headers.get && res.headers.get( "content-length" ) === "0" ) return null;
         return res.json ? res.json() : null;
      } )
      .then( function ( ) {
         rec.tags_chatgpt = payload.tags_chatgpt;
         rec.tags_bard = payload.tags_bard;

         const idx = state.allRecords.findIndex( function ( r ) { return r.id === rec.id; } );
         if ( idx !== -1 ) {
            state.allRecords[ idx ].tags_chatgpt = rec.tags_chatgpt;
            state.allRecords[ idx ].tags_bard = rec.tags_bard;
         }

         var removedCurrent = false;
         var previousIndex = state.current;
         if ( state.filterUntagged ) {
            state.records = state.records.filter( function ( r ) {
               return !r.tags_chatgpt && !r.tags_bard;
            } );
            // if we tagged it, it is no longer in the filtered list
            removedCurrent = true;
            if ( state.current >= state.records.length ) {
               state.current = Math.max( state.records.length - 1, 0 );
            }
         }

         if ( removedCurrent ) {
            state.current = Math.min( previousIndex, Math.max( state.records.length - 1, 0 ) );
         }

         state.tagStats = collectTagStats( state.allRecords.length ? state.allRecords : state.records );
         state.suggestions = state.tagStats;
         renderTagFilter( );
         renderTagReplaceOptions( );
         renderTagPickers( );
         renderAvailableTags( );
         updateMissingButton( );
         // reapply current filters to refresh the working list
         state.records = filterRecords( );

         var currentId = rec.id;
         var idxInFiltered = state.records.findIndex( function ( r ) { return String( r.id ) === String( currentId ); } );

         if ( advance ) {
            var targetIndex;
            if ( idxInFiltered === -1 ) {
               targetIndex = Math.min( state.current, Math.max( state.records.length - 1, 0 ) );
            } else {
               targetIndex = Math.min( idxInFiltered + 1, Math.max( state.records.length - 1, 0 ) );
            }
            state.current = targetIndex;
         } else {
            if ( idxInFiltered !== -1 ) {
               state.current = idxInFiltered;
            } else {
               state.current = Math.min( state.current, Math.max( state.records.length - 1, 0 ) );
            }
         }

         renderRecord( );

         if ( !advance && status ) {
            status.textContent = "Saved";
            setTimeout( function ( ) { status.textContent = ""; }, 1000 );
         }
      } )
      .catch( function ( err ) {
         if ( status ) status.textContent = `Error: ${err.message}`;
      } );
}

function goNext( ) {
   if ( state.current < state.records.length - 1 ) {
      state.current += 1;
      renderRecord( );
   }
}

function goPrev( ) {
   if ( state.current > 0 ) {
      state.current -= 1;
      renderRecord( );
   }
}

function applyFilter( ) {
   const filter = qs( "#filter_untagged" );
   state.filterUntagged = filter ? filter.checked : false;

   const catSelect = qs( "#category_filter" );
   state.categoryFilter = catSelect ? ( catSelect.value || "all" ) : "all";
   const tagSelect = qs( "#tag_filter" );
   state.tagFilter = tagSelect ? ( tagSelect.value || "all" ) : "all";

   state.records = filterRecords( );

    updateUrlFilters( );

   const targetId = getIdFromUrl( );
   if ( !( targetId != null && setCurrentById( targetId ) ) ) {
      state.current = 0;
   }

   state.tagStats = collectTagStats( state.allRecords );
   state.suggestions = state.tagStats;
   renderTagFilter( );
   renderRecord( );
   renderTagReplaceOptions( );
}

function filterRecords( ) {
   const source = state.allRecords.length ? state.allRecords.slice( ) : state.records.slice( );

   return source.filter( function ( rec ) {
      const catMatch = state.categoryFilter === "all" ||
         String( rec.prompt_category || "" ) === String( state.categoryFilter );
      const needsTag = !state.filterUntagged || ( !rec.tags_chatgpt && !rec.tags_bard );
      const tagMatch = ( function ( ) {
         if ( state.tagFilter === "all" ) return true;
         const tags = parseTags( rec.tags_chatgpt ).concat( parseTags( rec.tags_bard ) );
         return tags.some( function ( t ) { return t.toLowerCase( ) === state.tagFilter.toLowerCase( ); } );
      } )( );
      return catMatch && needsTag && tagMatch;
   } );
}

function restoreFiltersFromUrl( ) {
   try {
      const params = new URLSearchParams( window.location.search );
      const untagged = params.get( "untagged" );
      const cat = params.get( "cat" );
      const tag = params.get( "tag" );

      const chk = qs( "#filter_untagged" );
      if ( chk ) {
         chk.checked = untagged === "1";
         state.filterUntagged = chk.checked;
      }

      const catSel = qs( "#category_filter" );
      if ( catSel && cat && catSel.querySelector( `option[value="${cat}"]` ) ) {
         catSel.value = cat;
         state.categoryFilter = cat;
      }

      const tagSel = qs( "#tag_filter" );
      if ( tagSel && tag && tagSel.querySelector( `option[value="${tag}"]` ) ) {
         tagSel.value = tag;
         state.tagFilter = tag;
      }
   } catch ( err ) {
      console.warn( "[filters] restore failed", err );
   }
}

function updateUrlFilters( ) {
   try {
      const url = new URL( window.location.href );
      url.searchParams.set( "untagged", state.filterUntagged ? "1" : "0" );
      url.searchParams.set( "cat", state.categoryFilter || "all" );
      url.searchParams.set( "tag", state.tagFilter || "all" );
      window.history.replaceState( { }, "", url.toString( ) );
   } catch ( err ) {
      console.warn( "[filters] update failed", err );
   }
}

function loadData( ) {
   const status = qs( "#status" );
   if ( status ) status.textContent = "Loading...";

   fetch( "/api/explanations" )
      .then( function ( res ) {
         if ( !res.ok ) {
            throw new Error( `Load failed (${res.status})` );
         }
         return res.json( );
      } )
      .then( function ( data ) {
         state.allRecords = Array.isArray( data ) ? data : [ ];
         state.current = 0;

         state.tagStats = collectTagStats( state.allRecords );
         state.suggestions = state.tagStats;

         renderCategoryFilter( );
         renderTagFilter( );
         restoreFiltersFromUrl( );
         renderTagReplaceOptions( );
         updateMissingButton( );
         applyFilter( );
      } )
      .catch( function ( err ) {
         if ( status ) status.textContent = `Error: ${err.message}`;
      } );
}

function wireEvents( ) {
   qs( "#btn_prev" ).addEventListener( "click", function ( ) { goPrev( ); } );
   qs( "#btn_next" ).addEventListener( "click", function ( ) { goNext( ); } );
   qs( "#btn_save" ).addEventListener( "click", function ( ) { saveTags( false ); } );
   qs( "#btn_save_next" ).addEventListener( "click", function ( ) { saveTags( true ); } );
   const btnTagMissing = qs( "#btn_tag_missing" );
   if ( btnTagMissing ) {
      btnTagMissing.addEventListener( "click", function ( ) { applyMissingTag( ); } );
   }

   const filter = qs( "#filter_untagged" );
   if ( filter ) {
      filter.addEventListener( "change", function ( ) { applyFilter( ); } );
   }

   const catSelect = qs( "#category_filter" );
   if ( catSelect ) {
      catSelect.addEventListener( "change", function ( ) {
         state.categoryFilter = catSelect.value || "all";
         applyFilter( );
      } );
   }

   const tagSelect = qs( "#tag_filter" );
   if ( tagSelect ) {
      tagSelect.addEventListener( "change", function ( ) {
         state.tagFilter = tagSelect.value || "all";
         applyFilter( );
      } );
   }

   qs( "#add_chatgpt" ).addEventListener( "click", function ( ) {
      addTagsFromInput( "chatgpt" );
      saveTags( false );
   } );
   qs( "#add_bard" ).addEventListener( "click", function ( ) {
      addTagsFromInput( "bard" );
      saveTags( false );
   } );
   const applyCg = qs( "#apply_chatgpt" );
   if ( applyCg ) {
      applyCg.addEventListener( "click", function ( ) { applySelectedTag( "chatgpt" ); } );
   }
   const applyBard = qs( "#apply_bard" );
   if ( applyBard ) {
      applyBard.addEventListener( "click", function ( ) { applySelectedTag( "bard" ); } );
   }

   [ "#tags_chatgpt_input", "#tags_bard_input" ].forEach( function ( sel ) {
      const el = qs( sel );
      if ( !el ) return;
      el.addEventListener( "keydown", function ( e ) {
         if ( e.key === "Enter" ) {
            e.preventDefault( );
            addTagsFromInput( sel.indexOf( "chatgpt" ) !== -1 ? "chatgpt" : "bard" );
         }
      } );
   } );

   qs( "#btn_rename" ).addEventListener( "click", function ( ) { renameTag( ); } );
   const replaceBtn = qs( "#btn_replace" );
   if ( replaceBtn ) {
      replaceBtn.addEventListener( "click", function ( ) { replaceTagEverywhere( ); } );
   }
}

function renderCategoryFilter( ) {
   const select = qs( "#category_filter" );
   if ( !select ) return;

   const counts = { };
   state.allRecords.forEach( function ( rec ) {
      const key = String( rec.prompt_category || "" );
      counts[ key ] = ( counts[ key ] || 0 ) + 1;
   } );

   const options = Object.keys( counts )
      .sort( function ( a, b ) { return a.localeCompare( b ); } )
      .map( function ( key ) {
         const label = key.length ? key : "(Uncategorized)";
         return { value: key, label: `${label} (${counts[ key ]})` };
      } );

   const current = select.value || state.categoryFilter || "all";
   while ( select.firstChild ) select.removeChild( select.firstChild );

   const optAll = document.createElement( "option" );
   optAll.value = "all";
   optAll.textContent = `All (${state.allRecords.length})`;
   select.appendChild( optAll );

   options.forEach( function ( opt ) {
      const optionEl = document.createElement( "option" );
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      select.appendChild( optionEl );
   } );

   select.value = current;
}

function renderTagFilter( ) {
   const select = qs( "#tag_filter" );
   if ( !select ) return;

   const counts = { };
   state.tagStats.forEach( function ( tagObj ) {
      counts[ tagObj.label ] = ( tagObj.counts.overall || 0 );
   } );

   const options = Object.keys( counts )
      .sort( function ( a, b ) { return a.toLowerCase( ).localeCompare( b.toLowerCase( ) ); } )
      .map( function ( key ) {
         return { value: key, label: `${key} (${counts[ key ]})` };
      } );

   const current = select.value || state.tagFilter || "all";
   while ( select.firstChild ) select.removeChild( select.firstChild );

   const optAll = document.createElement( "option" );
   optAll.value = "all";
   optAll.textContent = `All (${state.allRecords.length})`;
   select.appendChild( optAll );

   options.forEach( function ( opt ) {
      const optionEl = document.createElement( "option" );
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      select.appendChild( optionEl );
   } );

   // if current selection vanished, fall back to all
   if ( current !== "all" && !counts[ current ] ) {
      select.value = "all";
      state.tagFilter = "all";
   } else {
      select.value = current;
   }
}

function renderTagReplaceOptions( ) {
   const fromSel = qs( "#replace_from" );
   const toSel = qs( "#replace_to" );
   if ( !fromSel || !toSel ) return;

   const tags = state.tagStats.map( function ( t ) { return t.label; } )
      .sort( function ( a, b ) { return a.toLowerCase( ).localeCompare( b.toLowerCase( ) ); } );

   function fill( sel ) {
      const prev = sel.value;
      while ( sel.firstChild ) sel.removeChild( sel.firstChild );
      tags.forEach( function ( t ) {
         const opt = document.createElement( "option" );
         opt.value = t;
         opt.textContent = t;
         sel.appendChild( opt );
      } );
      if ( prev && tags.indexOf( prev ) !== -1 ) {
         sel.value = prev;
      }
   }

   fill( fromSel );
   fill( toSel );
}

function getIdFromUrl( ) {
   try {
      const params = new URLSearchParams( window.location.search );
      const idStr = params.get( "id" );
      if ( idStr == null ) return null;
      const num = Number( idStr );
      return Number.isFinite( num ) ? num : null;
   } catch ( err ) {
      return null;
   }
}

function setIdInUrl( idVal ) {
   if ( idVal == null ) return;
   const url = new URL( window.location.href );
   url.searchParams.set( "id", idVal );
   window.history.replaceState( { }, "", url.toString( ) );
}

function setCurrentById( idVal ) {
   if ( idVal == null ) return false;
   const idx = state.records.findIndex( function ( r ) { return String( r.id ) === String( idVal ); } );
   if ( idx >= 0 ) {
      state.current = idx;
      return true;
   }
   return false;
}

function renderSuggestions( list, containerSel, side ) {
   const container = qs( containerSel );
   if ( !container ) return;
   container.innerHTML = "";

   const currentSet = new Set(
      ( side === "chatgpt" ? state.currentTags.chatgpt : state.currentTags.bard )
         .map( function ( t ) { return t.toLowerCase( ); } )
   );

   list.forEach( function ( tagObj ) {
      const tag = tagObj.label;
      if ( currentSet.has( tag.toLowerCase( ) ) ) {
         return;
      }

      const chip = document.createElement( "div" );
      chip.className = "chip removable";

      const btnAdd = document.createElement( "button" );
      btnAdd.setAttribute( "type", "button" );
      btnAdd.className = "chip-text";
      btnAdd.textContent = tag;
      btnAdd.style.background = "transparent";
      btnAdd.style.border = "none";
      btnAdd.style.cursor = "pointer";
      btnAdd.addEventListener( "click", function ( ) {
         addTagToCurrent( side, tag );
      } );

      const btnEdit = document.createElement( "button" );
      btnEdit.setAttribute( "type", "button" );
      btnEdit.className = "edit";
      btnEdit.textContent = "Edit";
      btnEdit.title = "Edit (prefill rename)";
      btnEdit.addEventListener( "click", function ( ev ) {
         ev.stopPropagation( );
         prefillRename( tag );
      } );

      const btnRemove = document.createElement( "button" );
      btnRemove.setAttribute( "type", "button" );
      btnRemove.className = "remove";
      btnRemove.textContent = "X";
      btnRemove.title = "Remove this tag from all records";
      btnRemove.addEventListener( "click", function ( ev ) {
         ev.stopPropagation( );
         removeTagEverywhere( tag );
      } );

      chip.appendChild( btnAdd );

      const overallBadge = document.createElement( "span" );
      overallBadge.className = "badge overall";
      overallBadge.textContent = tagObj.counts.overall || 0;
      overallBadge.title = "Overall";
      chip.appendChild( overallBadge );

      const cgBadge = document.createElement( "span" );
      cgBadge.className = "badge chatgpt";
      cgBadge.textContent = tagObj.counts.chatgpt || 0;
      cgBadge.title = "ChatGPT";
      chip.appendChild( cgBadge );

      const bardBadge = document.createElement( "span" );
      bardBadge.className = "badge bard";
      bardBadge.textContent = tagObj.counts.bard || 0;
      bardBadge.title = "Bard";
      chip.appendChild( bardBadge );

      chip.appendChild( btnEdit );
      chip.appendChild( btnRemove );
      container.appendChild( chip );
   } );
}

function renderAvailableTags( ) {
   const container = qs( "#available_tags" );
   if ( !container ) return;
   container.innerHTML = "";

   state.tagStats.forEach( function ( tagObj ) {
      const tag = tagObj.label;
      const chip = document.createElement( "div" );
      chip.className = "chip removable";

      const text = document.createElement( "span" );
      text.textContent = tag;
      chip.appendChild( text );

      const overallBadge = document.createElement( "span" );
      overallBadge.className = "badge overall";
      overallBadge.textContent = tagObj.counts.overall || 0;
      overallBadge.title = "Overall";
      chip.appendChild( overallBadge );

      const cgBadge = document.createElement( "span" );
      cgBadge.className = "badge chatgpt";
      cgBadge.textContent = tagObj.counts.chatgpt || 0;
      cgBadge.title = "ChatGPT";
      chip.appendChild( cgBadge );

      const bardBadge = document.createElement( "span" );
      bardBadge.className = "badge bard";
      bardBadge.textContent = tagObj.counts.bard || 0;
      bardBadge.title = "Bard";
      chip.appendChild( bardBadge );

      const btnEdit = document.createElement( "button" );
      btnEdit.type = "button";
      btnEdit.className = "edit";
      btnEdit.textContent = "Edit";
      btnEdit.title = "Edit (prefill rename)";
      btnEdit.addEventListener( "click", function ( ev ) {
         ev.stopPropagation( );
         prefillRename( tag );
      } );
      chip.appendChild( btnEdit );

      const btnRemove = document.createElement( "button" );
      btnRemove.type = "button";
      btnRemove.className = "remove";
      btnRemove.textContent = "X";
      btnRemove.title = "Remove this tag from all records";
      btnRemove.addEventListener( "click", function ( ev ) {
         ev.stopPropagation( );
         removeTagEverywhere( tag );
      } );
      chip.appendChild( btnRemove );

      container.appendChild( chip );
   } );
}

function renderCurrentTags( tags, containerSel, side ) {
   const container = qs( containerSel );
   if ( !container ) return;
   container.innerHTML = "";

   tags.forEach( function ( tag ) {
      const chip = document.createElement( "div" );
      chip.className = "chip removable current";

      const text = document.createElement( "span" );
      text.textContent = tag;

      const counts = getTagCounts( tag );
      const overallBadge = document.createElement( "span" );
      overallBadge.className = "badge overall";
      overallBadge.textContent = counts.overall || 0;
      overallBadge.title = "Overall";

      const sideBadge = document.createElement( "span" );
      sideBadge.className = "badge " + ( side === "chatgpt" ? "chatgpt" : "bard" );
      sideBadge.textContent = ( side === "chatgpt" ? counts.chatgpt : counts.bard ) || 0;
      sideBadge.title = side === "chatgpt" ? "ChatGPT" : "Bard";

      const btnEdit = document.createElement( "button" );
      btnEdit.setAttribute( "type", "button" );
      btnEdit.className = "edit";
      btnEdit.textContent = "Edit";
      btnEdit.title = "Edit (prefill rename)";
      btnEdit.addEventListener( "click", function ( ev ) {
         ev.stopPropagation( );
         prefillRename( tag );
      } );

      const btnRemove = document.createElement( "button" );
      btnRemove.setAttribute( "type", "button" );
      btnRemove.className = "remove";
      btnRemove.textContent = "X";
      btnRemove.title = "Remove tag from this record";
      btnRemove.addEventListener( "click", function ( ev ) {
         ev.stopPropagation( );
         removeTagFromCurrent( side, tag );
      } );

      chip.appendChild( text );
      chip.appendChild( overallBadge );
      chip.appendChild( sideBadge );
      chip.appendChild( btnEdit );
      chip.appendChild( btnRemove );
      container.appendChild( chip );
   } );
}

function renderTagPickers( ) {
   const cgList = qs( "#list_chatgpt" );
   const bardList = qs( "#list_bard" );
   if ( cgList ) {
      fillPickerOptions( cgList, "chatgpt" );
   }
   if ( bardList ) {
      fillPickerOptions( bardList, "bard" );
   }
}

function fillPickerOptions( listEl, side ) {
   while ( listEl.firstChild ) listEl.removeChild( listEl.firstChild );
   const currentSet = new Set(
      ( side === "chatgpt" ? state.currentTags.chatgpt : state.currentTags.bard )
         .map( function ( t ) { return t.toLowerCase( ); } )
   );
   state.tagStats.forEach( function ( tagObj ) {
      if ( currentSet.has( tagObj.label.toLowerCase( ) ) ) return;
      const opt = document.createElement( "option" );
      opt.value = tagObj.label;
      listEl.appendChild( opt );
   } );
}

function parseTags( raw ) {
   if ( !raw ) return [ ];
   return raw
      .split( "," )
      .map( function ( t ) { return t.trim( ); } )
      .filter( function ( t ) { return t.length > 0; } );
}

function collectTagStats( records ) {
   const stats = {
      overall: { },
      chatgpt: { },
      bard: { },
      labelForKey: { },
   };

   function add( tag, bucket ) {
      const key = tag.toLowerCase( );
      if ( !stats.labelForKey[ key ] ) {
         stats.labelForKey[ key ] = tag;
      }
      stats[ bucket ][ key ] = ( stats[ bucket ][ key ] || 0 ) + 1;
      stats.overall[ key ] = ( stats.overall[ key ] || 0 ) + 1;
   }

   records.forEach( function ( rec ) {
      parseTags( rec.tags_chatgpt ).forEach( function ( t ) { add( t, "chatgpt" ); } );
      parseTags( rec.tags_bard ).forEach( function ( t ) { add( t, "bard" ); } );
   } );

   const keys = Object.keys( stats.labelForKey ).sort( function ( a, b ) {
      return a.toLowerCase( ).localeCompare( b.toLowerCase( ) );
   } );

   return keys.map( function ( key ) {
      return {
         key: key,
         label: stats.labelForKey[ key ],
         counts: {
            overall: stats.overall[ key ] || 0,
            chatgpt: stats.chatgpt[ key ] || 0,
            bard: stats.bard[ key ] || 0,
         },
      };
   } );
}

function getTagCounts( tag ) {
   const key = ( tag || "" ).toLowerCase( );
   const found = state.tagStats.find( function ( t ) { return t.key === key; } );
   return found ? found.counts : { overall: 0, chatgpt: 0, bard: 0 };
}

function addTagsFromInput( side ) {
   const input = qs( side === "chatgpt" ? "#tags_chatgpt_input" : "#tags_bard_input" );
   if ( !input ) return;
   const raw = input.value || "";
   const tags = parseTags( raw );
   tags.forEach( function ( t ) { addTagToCurrent( side, t ); } );
   input.value = "";
}

function addTagToCurrent( side, tag ) {
   const bucket = side === "chatgpt" ? state.currentTags.chatgpt : state.currentTags.bard;
   if ( !tag ) return;
   const exists = bucket.some( function ( t ) { return t.toLowerCase( ) === tag.toLowerCase( ); } );
   if ( !exists ) {
      bucket.push( tag );
      bucket.sort( function ( a, b ) { return a.toLowerCase( ) < b.toLowerCase( ) ? -1 : 1; } );
      renderCurrentTags( bucket, side === "chatgpt" ? "#current_chatgpt" : "#current_bard", side );
      renderSuggestions( state.suggestions, "#suggest_chatgpt", "chatgpt" );
      renderSuggestions( state.suggestions, "#suggest_bard", "bard" );
      return true;
   }
   return false;
}

function prefillRename( tag ) {
   const oldInput = qs( "#rename_old" );
   const newInput = qs( "#rename_new" );
   if ( oldInput ) {
      oldInput.value = tag;
   }
   if ( newInput ) {
      newInput.value = tag;
      newInput.focus( );
      newInput.select( );
   }
}

function removeTagFromCurrent( side, tag ) {
   const bucket = side === "chatgpt" ? state.currentTags.chatgpt : state.currentTags.bard;
   const filtered = bucket.filter( function ( t ) { return t.toLowerCase( ) !== tag.toLowerCase( ); } );

   if ( side === "chatgpt" ) {
      state.currentTags.chatgpt = filtered;
   } else {
      state.currentTags.bard = filtered;
   }

   const rec = state.records[ state.current ];
   if ( rec ) {
      if ( side === "chatgpt" ) {
         rec.tags_chatgpt = filtered.join( ", " );
      } else {
         rec.tags_bard = filtered.join( ", " );
      }
      const matchIdx = state.allRecords.findIndex( function ( r ) { return r.id === rec.id; } );
      if ( matchIdx !== -1 ) {
         state.allRecords[ matchIdx ].tags_chatgpt = rec.tags_chatgpt;
         state.allRecords[ matchIdx ].tags_bard = rec.tags_bard;
      }
   }

   state.tagStats = collectTagStats( state.allRecords );
   state.suggestions = state.tagStats;
   renderTagFilter( );
   renderCurrentTags( filtered, side === "chatgpt" ? "#current_chatgpt" : "#current_bard", side );
   renderSuggestions( state.suggestions, "#suggest_chatgpt", "chatgpt" );
   renderSuggestions( state.suggestions, "#suggest_bard", "bard" );
   renderTagReplaceOptions( );
}

function removeTagEverywhere( tag ) {
   const status = qs( "#status" );
   if ( status ) status.textContent = `Removing tag "${tag}" from all records...`;

   fetch( "/api/tags/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify( { tag: tag } ),
   } )
      .then( function ( res ) {
         if ( !res.ok ) {
            throw new Error( `Remove failed (${res.status})` );
         }
         return res.json( );
      } )
      .then( function ( data ) {
         if ( status ) status.textContent = `Removed from ${data.removed_rows || 0} records`;
         setTimeout( function ( ) { if ( status ) status.textContent = ""; }, 1200 );
         loadData( );
      } )
      .catch( function ( err ) {
         if ( status ) status.textContent = `Error: ${err.message}`;
      } );
}

function replaceTagEverywhere( ) {
   const status = qs( "#status" );
   const fromSel = qs( "#replace_from" );
   const toSel = qs( "#replace_to" );
   if ( !fromSel || !toSel ) return;

   const oldTag = ( fromSel.value || "" ).trim( );
   const newTag = ( toSel.value || "" ).trim( );
   if ( !oldTag || !newTag ) {
      if ( status ) status.textContent = "Select both tags first";
      return;
   }
   if ( oldTag === newTag ) {
      if ( status ) status.textContent = "Choose two different tags";
      return;
   }

   if ( status ) status.textContent = `Replacing "${oldTag}" with "${newTag}"...`;

   fetch( "/api/tags/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify( { old_tag: oldTag, new_tag: newTag } ),
   } )
      .then( function ( res ) {
         if ( !res.ok ) {
            throw new Error( `Replace failed (${res.status})` );
         }
         return res.json( );
      } )
      .then( function ( data ) {
         if ( status ) status.textContent = `Replaced in ${data.updated_rows || 0} records`;
         setTimeout( function ( ) { if ( status ) status.textContent = ""; }, 1200 );
         loadData( );
      } )
      .catch( function ( err ) {
         if ( status ) status.textContent = `Error: ${err.message}`;
      } );
}

function renameTag( ) {
   const status = qs( "#status" );
   const oldInput = qs( "#rename_old" );
   const newInput = qs( "#rename_new" );

   const oldTag = ( oldInput.value || "" ).trim( );
   const newTag = ( newInput.value || "" ).trim( );

   if ( !oldTag || !newTag ) {
      if ( status ) status.textContent = "Both old and new tags are required";
      return;
   }

   if ( status ) status.textContent = `Renaming "${oldTag}" to "${newTag}"...`;

   fetch( "/api/tags/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify( { old_tag: oldTag, new_tag: newTag } ),
   } )
      .then( function ( res ) {
         if ( !res.ok ) {
            throw new Error( `Rename failed (${res.status})` );
         }
         return res.json( );
      } )
      .then( function ( data ) {
         if ( status ) status.textContent = `Renamed in ${data.updated_rows || 0} records`;
         setTimeout( function ( ) { if ( status ) status.textContent = ""; }, 1200 );
         oldInput.value = "";
         newInput.value = "";
         loadData( );
      } )
      .catch( function ( err ) {
         if ( status ) status.textContent = `Error: ${err.message}`;
   } );
}

function applyMissingTag( ) {
   const status = qs( "#status" );
   if ( status ) status.textContent = "Tagging missing explanations...";

   fetch( "/api/tags/add_missing_explanations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify( { tag: "worker did not provide an explanation" } ),
   } )
      .then( function ( res ) {
         if ( !res.ok ) {
            throw new Error( `Apply failed (${res.status})` );
         }
         return res.json();
      } )
      .then( function ( data ) {
         if ( status ) status.textContent = `Tagged ${data.updated_rows || 0} records`;
         setTimeout( function ( ) { if ( status ) status.textContent = ""; }, 1200 );
         loadData( );
      } )
      .catch( function ( err ) {
         if ( status ) status.textContent = `Error: ${err.message}`;
   } );
}

function applySelectedTag( side ) {
   const input = qs( side === "chatgpt" ? "#pick_chatgpt" : "#pick_bard" );
   if ( !input ) return;
   const raw = ( input.value || "" ).trim( );
   if ( !raw ) return;
   // find matching suggestion to preserve casing
   var match = state.tagStats.find( function ( t ) { return t.label.toLowerCase( ) === raw.toLowerCase( ); } );
   const tagToAdd = match ? match.label : raw;
   const added = addTagToCurrent( side, tagToAdd );
   input.value = "";
   renderTagPickers( );
   if ( added ) {
      saveTags( false );
   }
}

window.addEventListener( "load", function ( ) {
   wireEvents( );
   loadData( );
} );

function updateNavButtons( ) {
   const btnPrev = qs( "#btn_prev" );
   const btnNext = qs( "#btn_next" );
   const btnSaveNext = qs( "#btn_save_next" );

   var atFirst = state.current <= 0;
   var atLast = state.current >= Math.max( state.records.length - 1, 0 );

   if ( btnPrev ) btnPrev.disabled = atFirst;
   if ( btnNext ) btnNext.disabled = atLast;
   if ( btnSaveNext ) btnSaveNext.disabled = atLast;
}

function updateMissingButton( ) {
   const btn = qs( "#btn_tag_missing" );
   if ( !btn ) return;
   const tagText = "worker did not provide an explanation";
   const hasMissing = state.allRecords.some( function ( rec ) {
      const expl = ( rec.explanation || "" ).trim();
      if ( expl.length ) return false;
      const combined = `${rec.tags_chatgpt || ""},${rec.tags_bard || ""}`.toLowerCase( );
      return combined.indexOf( tagText.toLowerCase( ) ) === -1;
   } );
   btn.style.display = hasMissing ? "" : "none";
}
