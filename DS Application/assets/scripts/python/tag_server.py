import json
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd


BASE_DIR = Path( __file__ ).resolve().parents[ 3 ]
DATA_PATH = BASE_DIR / "assets/data/extract/explanations.csv"


def load_rows( ):
   df = pd.read_csv( DATA_PATH, keep_default_na = False )

   if "ID" not in df.columns:
      df[ "ID" ] = range( 1, len( df ) + 1 )

   if "Tags - ChatGPT" not in df.columns:
      df[ "Tags - ChatGPT" ] = ""
   if "Tags - Bard" not in df.columns:
      df[ "Tags - Bard" ] = ""

   df[ "Tags - ChatGPT" ] = df[ "Tags - ChatGPT" ].fillna( "" ).astype( str )
   df[ "Tags - Bard" ] = df[ "Tags - Bard" ].fillna( "" ).astype( str )

   records = [ ]

   def safe_val( value ):
      if value is None:
         return ""
      text = str( value )
      return "" if text.lower() == "nan" else text

   for idx, row in df.iterrows( ):
      records.append(
         {
            "id": int( safe_val( row.get( "ID", idx + 1 ) ) or ( idx + 1 ) ),
            "rating": safe_val( row.get( "Rating", "" ) ),
            "prompt_category": safe_val( row.get( "Prompt Category", "" ) ),
            "prompt": safe_val( row.get( "Prompt", "" ) ),
            "chatgpt": safe_val( row.get( "ChatGPT", "" ) ),
            "bard": safe_val( row.get( "Bard", "" ) ),
            "explanation": safe_val( row.get( "Explanation", "" ) ),
            "tags_chatgpt": safe_val( row.get( "Tags - ChatGPT", "" ) ),
            "tags_bard": safe_val( row.get( "Tags - Bard", "" ) ),
         }
      )

   return records


def update_row( record_id, tags_chatgpt, tags_bard ):
   df = pd.read_csv( DATA_PATH, keep_default_na = False )

   if "ID" not in df.columns:
      df[ "ID" ] = range( 1, len( df ) + 1 )

   df[ "ID" ] = df[ "ID" ].fillna( "" )

   try:
      target_idx = df.index[ df[ "ID" ].astype( str ) == str( record_id ) ][ 0 ]
   except Exception:
      if isinstance( record_id, int ) and 0 <= record_id < len( df ):
         target_idx = record_id
      else:
         raise IndexError( f"Record id {record_id} not found." )

   if "Tags - ChatGPT" not in df.columns:
      df[ "Tags - ChatGPT" ] = ""
   if "Tags - Bard" not in df.columns:
      df[ "Tags - Bard" ] = ""

   df.at[ target_idx, "Tags - ChatGPT" ] = tags_chatgpt
   df.at[ target_idx, "Tags - Bard" ] = tags_bard

   df.to_csv( DATA_PATH, index = False )


def remove_tag_globally( tag_value ):
   """
   Remove a tag (case-insensitive match) from both tag columns across all rows.
   Returns the count of rows modified.
   """
   if not tag_value:
      return 0

   df = pd.read_csv( DATA_PATH, keep_default_na = False )

   tag_ci = tag_value.strip().casefold()
   if not tag_ci:
      return 0

   changed_rows = 0
   tag_cols = [ "Tags - ChatGPT", "Tags - Bard" ]

   for col in tag_cols:
      if col not in df.columns:
         df[ col ] = ""

   for idx, _ in df.iterrows( ):
      row_changed = False
      for col in tag_cols:
         raw = str( df.at[ idx, col ] or "" )
         parts = [ p.strip() for p in raw.split( "," ) if p.strip() ]
         filtered = [ p for p in parts if p.casefold() != tag_ci ]
         if filtered != parts:
            df.at[ idx, col ] = ", ".join( filtered )
            row_changed = True
      if row_changed:
         changed_rows += 1

   df.to_csv( DATA_PATH, index = False )
   return changed_rows


def rename_tag_globally( old_value, new_value ):
   """
   Rename a tag (case-insensitive match) to a new value across both tag columns.
   Returns the count of rows modified.
   """
   if not old_value or not new_value:
      return 0

   df = pd.read_csv( DATA_PATH, keep_default_na = False )

   old_ci = old_value.strip().casefold()
   new_clean = new_value.strip()

   if not old_ci or not new_clean:
      return 0

   changed_rows = 0
   tag_cols = [ "Tags - ChatGPT", "Tags - Bard" ]

   for col in tag_cols:
      if col not in df.columns:
         df[ col ] = ""

   for idx, _ in df.iterrows( ):
      row_changed = False
      for col in tag_cols:
         raw = str( df.at[ idx, col ] or "" )
         parts = [ p.strip() for p in raw.split( "," ) if p.strip() ]
         renamed = [ new_clean if p.casefold() == old_ci else p for p in parts ]
         if renamed != parts:
            df.at[ idx, col ] = ", ".join( renamed )
            row_changed = True
      if row_changed:
         changed_rows += 1

   df.to_csv( DATA_PATH, index = False )
   return changed_rows


def add_tag_for_missing_explanations( tag_value ):
   """
   For any row with a blank/empty Explanation, add the given tag to both tag columns
   (case-insensitive dedupe). Returns count of rows modified.
   """
   if not tag_value:
      return 0

   df = pd.read_csv( DATA_PATH, keep_default_na = False )
   tag_clean = tag_value.strip()
   if not tag_clean:
      return 0
   tag_ci = tag_clean.casefold()

   tag_cols = [ "Tags - ChatGPT", "Tags - Bard" ]
   for col in tag_cols:
      if col not in df.columns:
         df[ col ] = ""

   changed_rows = 0
   for idx, _ in df.iterrows( ):
      expl = str( df.at[ idx, "Explanation" ] ) if "Explanation" in df.columns else ""
      if expl is None:
         expl = ""
      if str( expl ).strip() != "":
         continue

      row_changed = False
      for col in tag_cols:
         raw = str( df.at[ idx, col ] or "" )
         parts = [ p.strip() for p in raw.split( "," ) if p.strip() ]
         if all( p.casefold() != tag_ci for p in parts ):
            parts.append( tag_clean )
            df.at[ idx, col ] = ", ".join( parts )
            row_changed = True
      if row_changed:
         changed_rows += 1

   df.to_csv( DATA_PATH, index = False )
   return changed_rows


class TaggingHandler( SimpleHTTPRequestHandler ):

   def end_headers( self ):
      self.send_header( "Access-Control-Allow-Origin", "*" )
      self.send_header( "Access-Control-Allow-Methods", "GET, POST, OPTIONS" )
      self.send_header( "Access-Control-Allow-Headers", "Content-Type" )
      super( ).end_headers( )

   def do_OPTIONS( self ):
      self.send_response( 200 )
      self.end_headers( )

   def do_GET( self ):
      parsed = urlparse( self.path )

      if parsed.path == "/api/explanations":
         try:
            data = load_rows( )
         except Exception as exc:
            self.send_response( 500 )
            self.send_header( "Content-Type", "application/json" )
            self.end_headers( )
            self.wfile.write(
               json.dumps( { "error": f"Failed to load data: {exc}" } ).encode( "utf-8" )
            )
            return

         self.send_response( 200 )
         self.send_header( "Content-Type", "application/json" )
         self.end_headers( )
         self.wfile.write( json.dumps( data ).encode( "utf-8" ) )
         return

      return super( ).do_GET( )

   def do_POST( self ):
      parsed = urlparse( self.path )

      if parsed.path == "/api/tags/remove":
         content_length = int( self.headers.get( "Content-Length", 0 ) )
         body = self.rfile.read( content_length ) if content_length > 0 else b"{}"

         try:
            payload = json.loads( body.decode( "utf-8" ) )
         except json.JSONDecodeError:
            payload = { }

         tag_value = str( payload.get( "tag", "" ) ).strip()
         if not tag_value:
            self.send_response( 400 )
            self.send_header( "Content-Type", "application/json" )
            self.end_headers( )
            self.wfile.write(
               json.dumps( { "error": "Missing tag" } ).encode( "utf-8" )
            )
            return

         try:
            changed = remove_tag_globally( tag_value )
         except Exception as exc:
            self.send_response( 500 )
            self.send_header( "Content-Type", "application/json" )
            self.end_headers( )
            self.wfile.write(
               json.dumps( { "error": f"Failed to remove tag: {exc}" } ).encode( "utf-8" )
            )
            return

         self.send_response( 200 )
         self.send_header( "Content-Type", "application/json" )
         self.end_headers( )
         self.wfile.write( json.dumps( { "removed_rows": changed } ).encode( "utf-8" ) )
         return

      if parsed.path == "/api/tags/rename":
         content_length = int( self.headers.get( "Content-Length", 0 ) )
         body = self.rfile.read( content_length ) if content_length > 0 else b"{}"

         try:
            payload = json.loads( body.decode( "utf-8" ) )
         except json.JSONDecodeError:
            payload = { }

         old_value = str( payload.get( "old_tag", "" ) ).strip()
         new_value = str( payload.get( "new_tag", "" ) ).strip()

         if not old_value or not new_value:
            self.send_response( 400 )
            self.send_header( "Content-Type", "application/json" )
            self.end_headers( )
            self.wfile.write(
               json.dumps( { "error": "Both old_tag and new_tag are required" } ).encode( "utf-8" )
            )
            return

         try:
            changed = rename_tag_globally( old_value, new_value )
         except Exception as exc:
            self.send_response( 500 )
            self.send_header( "Content-Type", "application/json" )
            self.end_headers( )
            self.wfile.write(
               json.dumps( { "error": f"Failed to rename tag: {exc}" } ).encode( "utf-8" )
            )
            return

         self.send_response( 200 )
         self.send_header( "Content-Type", "application/json" )
         self.end_headers( )
         self.wfile.write( json.dumps( { "updated_rows": changed } ).encode( "utf-8" ) )
         return

      if parsed.path == "/api/tags/add_missing_explanations":
         content_length = int( self.headers.get( "Content-Length", 0 ) )
         body = self.rfile.read( content_length ) if content_length > 0 else b"{}"

         try:
            payload = json.loads( body.decode( "utf-8" ) )
         except json.JSONDecodeError:
            payload = { }

         tag_value = str( payload.get( "tag", "" ) ).strip() or "worker did not provide an explanation"

         try:
            changed = add_tag_for_missing_explanations( tag_value )
         except Exception as exc:
            self.send_response( 500 )
            self.send_header( "Content-Type", "application/json" )
            self.end_headers( )
            self.wfile.write(
               json.dumps( { "error": f"Failed to apply missing-explanation tag: {exc}" } ).encode( "utf-8" )
            )
            return

         self.send_response( 200 )
         self.send_header( "Content-Type", "application/json" )
         self.end_headers( )
         self.wfile.write( json.dumps( { "updated_rows": changed } ).encode( "utf-8" ) )
         return

      if parsed.path.startswith( "/api/explanations/" ):
         try:
            row_id_str = parsed.path.rsplit( "/", 1 )[ 1 ]
            row_id = int( row_id_str )
         except ( ValueError, IndexError ):
            self.send_response( 400 )
            self.send_header( "Content-Type", "application/json" )
            self.end_headers( )
            self.wfile.write(
               json.dumps( { "error": "Invalid row id" } ).encode( "utf-8" )
            )
            return

         content_length = int( self.headers.get( "Content-Length", 0 ) )
         body = self.rfile.read( content_length ) if content_length > 0 else b"{}"

         try:
            payload = json.loads( body.decode( "utf-8" ) )
         except json.JSONDecodeError:
            payload = { }

         tags_chatgpt = str( payload.get( "tags_chatgpt", "" ) )
         tags_bard = str( payload.get( "tags_bard", "" ) )

         try:
            update_row( row_id, tags_chatgpt, tags_bard )
         except IndexError as exc:
            self.send_response( 404 )
            self.send_header( "Content-Type", "application/json" )
            self.end_headers( )
            self.wfile.write( json.dumps( { "error": str( exc ) } ).encode( "utf-8" ) )
            return
         except Exception as exc:
            self.send_response( 500 )
            self.send_header( "Content-Type", "application/json" )
            self.end_headers( )
            self.wfile.write(
               json.dumps( { "error": f"Failed to update row: {exc}" } ).encode( "utf-8" )
            )
            return

         self.send_response( 204 )
         self.end_headers( )
         return

      return super( ).do_POST( )


def run( host = "127.0.0.1", port = 8000 ):
   handler_class = lambda *args, **kwargs: TaggingHandler(
      *args,
      directory = str( BASE_DIR ),
      **kwargs
   )

   httpd = HTTPServer( ( host, port ), handler_class )

   print( f"Serving tagger at http://{host}:{port}/tagger.html" )
   print( f"API: GET /api/explanations, POST /api/explanations/<row_id>" )
   print( f"CSV path: {DATA_PATH}" )

   try:
      httpd.serve_forever( )
   except KeyboardInterrupt:
      print( "\nShutting down server." )
      httpd.server_close( )


if __name__ == "__main__":
   run( )
