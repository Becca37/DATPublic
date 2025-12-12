import requests
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path
import textwrap
from pandas.api.types import CategoricalDtype
import re
import nltk
from collections import Counter

# ---------------------------------------------------------
# Housekeeping
# ---------------------------------------------------------

gsheet_url = "https://docs.google.com/spreadsheets/d/1iIVMU_CAOAWInD1ht3xjMkrdLk-yNSvVDIc6hyCLUf8/export?format=csv&gid=5263407"

BASE_ASSETS_DIR = Path( __file__ ).resolve().parents[ 3 ]
FIGURES_ROOT    = BASE_ASSETS_DIR / "output/figures"
CSV_ROOT    = BASE_ASSETS_DIR / "output/csv"

pd.set_option( 'display.max_columns', None )
pd.set_option( 'display.width', 200 )
pd.set_option( 'display.expand_frame_repr', False )
pd.set_option( "future.no_silent_downcasting", True )

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

from nltk.corpus import stopwords
stop_words = set(stopwords.words('english'))

rating_col = "Which model is more helpful, safe, and honest? (rating)"

FIG_SIZE = 4

FRIENDLY_NAMES = {
    "PromptLength": "Prompt Length",
    "ChatGPTLength": "ChatGPT Response Length",
    "BardLength": "Bard Response Length",
    "ExplanationLength": "Explanation Length",
    "ExplanationLengthNonZero": "Explanation Length (NonZero)",
    "Rating": "Rating (Text (Number))",
    "Which model is more helpful, safe, and honest? (rating)": "Rating",
    "Which model is more helpful, safe, and honest? (text)": "Rating (Text)",
    "PromptLengthBin": "Prompt Length",
}

RATING_TEXT_LABELS = {
   1: "Bard much better (1)",
   2: "Bard better (2)",
   3: "Bard slightly better (3)",
   4: "About the same (4)",
   5: "ChatGPT slightly better (5)",
   6: "ChatGPT better (6)",
   7: "ChatGPT much better (7)",
}

# ---------------------------------------------------------
def generate_plot_charts( df, column_name ):
# ---------------------------------------------------------
   """
   For a numeric column, plot the data
   to a combo box and violin chart
   then save as an image.
   """
   
   print( f" ... ... {column_name} ... " )
   
   outdir = FIGURES_ROOT / "visualize"
   outdir.mkdir( parents = True, exist_ok = True )

   friendly_name = FRIENDLY_NAMES.get( column_name, column_name )

   fig, ax = plt.subplots( figsize = ( FIG_SIZE, FIG_SIZE ) )

   ax.boxplot( df[ column_name ].dropna(), vert = True )
   ax.violinplot( df[ column_name ].dropna(), vert = True )

   ax.set_title( friendly_name, loc = "center" )
   ax.set_ylabel( "" )
   ax.set_xlabel( "" )
   
   ax.set_axisbelow( True )
   ax.yaxis.grid(
      True,
      color = "#F2F2F2",
      linestyle = "-",
      linewidth = 0.8,
   )
   
   ax.tick_params( axis = "x", which = "both", bottom = False, labelbottom = False )

   plt.tight_layout()

   safe_name = friendly_name.replace( " ", "_" )
   save_filename = f"{outdir}/{safe_name}.png"
   plt.savefig( save_filename, dpi = 300, bbox_inches = "tight" )
   plt.close()

# ---------------------------------------------------------
def generate_describe_table( df, column_name ):
# ---------------------------------------------------------
   """
   For numeric columns, describe the data,
   then save as .png.
   """
   
   print( f" ... ... {column_name} ... " )
   
   outdir = FIGURES_ROOT / "describe"
   outdir.mkdir( parents = True, exist_ok = True )

   friendly_name = FRIENDLY_NAMES.get( column_name, column_name )

   desc = df[ column_name ].describe()

   fmt_map = {
      "count": "{:.0f}", 
      "mean":  "{:.1f}",
      "std":   "{:.1f}",
      "min":   "{:.0f}",
      "25%":   "{:.1f}",
      "50%":   "{:.1f}",
      "75%":   "{:.1f}",
      "max":   "{:.0f}",
   }

   STAT_LABELS = {
      "count": "Count",
      "mean":  "Mean",
      "std":   "STD",
      "min":   "Min",
      "25%":   "25th %ile",
      "50%":   "Median",
      "75%":   "75th %ile",
      "max":   "Max",
   }

   stats = []
   values = []

   for stat_name, value in desc.items():
      fmt = fmt_map.get( stat_name, "{:.2f}" )
      if pd.isna( value ):
         formatted = ""
      else:
         formatted = fmt.format( value )
      stats.append( stat_name )
      values.append( formatted )

   display_stats = [ STAT_LABELS.get( name, name ) for name in stats ]

   desc_df = pd.DataFrame(
      {
         "Stat": display_stats,
         "Value": values,
      }
   )

   fig_height = 0.25 * len( desc_df ) + 0.65
   fig, ax = plt.subplots( figsize = ( FIG_SIZE, fig_height ) )
   ax.axis( "off" )

   ax.set_title( friendly_name, pad = 8, loc = "center" )

   cell_colours = []
   for i in range( len( desc_df ) ):
      row_color = "#FFFFFF" if ( i % 2 ) == 0 else "#F2F2F2"
      cell_colours.append( [ row_color ] * desc_df.shape[ 1 ] )

   table = ax.table(
      cellText = desc_df.values,
      colLabels = desc_df.columns,
      cellColours = cell_colours,
      loc = "upper center",
   )

   table.auto_set_font_size( False )
   table.set_fontsize( 8 )
   table.scale( 1, 1.3 )

   n_rows, n_cols = desc_df.shape
   cells = table.get_celld()

   for ( row, col ), cell in cells.items():
      if col == 0:
         cell.get_text().set_ha( "right" )
      elif col in ( 1, 2 ):
         cell.get_text().set_ha( "center" )
         
   for ( row, col ), cell in cells.items():
      cell.set_edgecolor( "none" )
      cell.set_linewidth( 0 )

   for col in range( n_cols ):
      header_cell = cells[ 0, col ]
      header_cell.visible_edges = "B" 
      header_cell.set_edgecolor( "black" )
      header_cell.set_linewidth( 1.6 )

   plt.tight_layout()

   safe_name = friendly_name.replace( " ", "_" )
   filename = f"{outdir}/Describe_{safe_name}.png"
   plt.savefig( filename, dpi = 300, bbox_inches = "tight" )
   plt.close()

# ---------------------------------------------------------
def generate_category_table( df, column_name ):
# ---------------------------------------------------------
   """
   Generates a simple table for data category values,
   then save as .png.
   """

   print( f" ... ... {column_name} ... " )
  
   outdir = FIGURES_ROOT / "category"
   outdir.mkdir( parents = True, exist_ok = True )

   friendly_name = FRIENDLY_NAMES.get( column_name, column_name )

   total = len( df )
   counts = df[ column_name ].value_counts( dropna = False )

   labels = []
   count_list = []
   percent_list = []

   for val, cnt in counts.items():
      label = "Missing" if pd.isna( val ) else str( val )
      labels.append( label )
      count_list.append( int( cnt ) )
      percent_list.append( f"{cnt / total * 100:.1f}%" )

   labels.append( "Total" )
   count_list.append( sum( count_list ) )
   percent_list.append( "100.0%" )

   table_df = pd.DataFrame(
      {
         "Value": labels,
         "Count": count_list,
         "% of Total": percent_list,
      }
   )

   fig_height = 0.25 * len( table_df ) + 0.65
   fig, ax = plt.subplots( figsize = ( FIG_SIZE, fig_height ) )
   ax.axis( "off" )
   ax.set_title( friendly_name, pad = 8, loc = "center" )

   cell_colours = []
   for i in range( len( table_df ) ):
      row_color = "#FFFFFF" if ( i % 2 ) == 0 else "#F2F2F2"
      cell_colours.append( [ row_color ] * table_df.shape[ 1 ] )
      
   col_widths = [ 0.5, 0.25, 0.25 ]

   table = ax.table(
      cellText = table_df.values,
      colLabels = table_df.columns,
      cellColours = cell_colours,
      loc = "upper center",
      colWidths = col_widths
   )

   table.auto_set_font_size( False )
   table.set_fontsize( 8 )
   table.scale( 1, 1.3 )

   n_rows, n_cols = table_df.shape
   cells = table.get_celld()

   header_border_width = 1.6 
   total_border_width  = 0.7 
   edge_color = "black"
   
   for ( row, col ), cell in cells.items():
      if col == 0:
         cell.get_text().set_ha( "right" )
      elif col in ( 1, 2 ):
         cell.get_text().set_ha( "center" )

   for ( row, col ), cell in cells.items():
      cell.set_edgecolor( "none" )
      cell.set_linewidth( 0 )

   for col in range( n_cols ):
      header_cell = cells[ 0, col ]
      header_cell.visible_edges = "B"    
      header_cell.set_edgecolor( "black" )
      header_cell.set_linewidth( 1.6 )

   total_row = n_rows
   for col in range( n_cols ):
      total_cell = cells[ total_row, col ]
      total_cell.set_facecolor( "#FFFFFF" )
      total_cell.visible_edges = "T"      
      total_cell.set_edgecolor( "black" )
      total_cell.set_linewidth( 0.7 )

   plt.tight_layout()

   safe_name = friendly_name.replace( " ", "_" )
   filename = outdir / f"Categories_{safe_name}.png"
   plt.savefig( filename, dpi = 300, bbox_inches = "tight" )
   plt.close()

# ---------------------------------------------------------
def generate_crosstab_csv( df, numeric_col, category_col ):
# ---------------------------------------------------------
   """
   Crosstab counts + percent-of-column in ONE CSV with a SINGLE header row.

   Columns are interleaved per category:
      <Category> (Count), <Category> (% of Column), ... , Total (Count), Total (% of Column)

   Rows:
      ratings 1..7 mapped via RATING_TEXT_LABELS + optional Missing + Total
   """

   friendly_rating   = FRIENDLY_NAMES.get( numeric_col, numeric_col )
   friendly_category = FRIENDLY_NAMES.get( category_col, category_col )

   print( f" ... ... CSV ( count + % of column ): {friendly_category} by {friendly_rating} ... " )

   outdir = CSV_ROOT / "crosstab"
   outdir.mkdir( parents = True, exist_ok = True )

   tmp_df = df.copy()

   tmp_df[ numeric_col ] = pd.to_numeric( tmp_df[ numeric_col ], errors = "coerce" ).astype( "Int64" )
   tmp_df[ numeric_col ] = tmp_df[ numeric_col ].astype( "string" )
   tmp_df[ numeric_col ] = tmp_df[ numeric_col ].where( tmp_df[ numeric_col ].notna(), "Missing" )

   tmp_df[ category_col ] = tmp_df[ category_col ].where( tmp_df[ category_col ].notna(), "Missing" )
   tmp_df[ category_col ] = tmp_df[ category_col ].astype( "string" )

   counts = pd.crosstab(
      index = tmp_df[ numeric_col ],
      columns = tmp_df[ category_col ],
      margins = True,
      margins_name = "Total",
      dropna = False
   )

   # Row order: 1..7, (Missing), Total
   rating_order = [ str( i ) for i in range( 1, 8 ) ]
   if "Missing" in counts.index:
      rating_order.append( "Missing" )

   row_order = [ r for r in rating_order if r in counts.index ]
   if "Total" in counts.index:
      row_order.append( "Total" )

   # Column order: keep, but Total last
   col_order = [ c for c in counts.columns if str( c ) != "Total" ]
   if "Total" in counts.columns:
      col_order.append( "Total" )

   counts = counts.reindex( index = row_order, columns = col_order, fill_value = 0 )

   # Percent-of-column
   pct = counts.astype( float ).copy()

   col_totals = pct.loc[ "Total" ] if "Total" in pct.index else pct.sum( axis = 0 )

   for col in pct.columns:
      denom = float( col_totals.get( col, 0.0 ) )
      if denom > 0:
         pct[ col ] = ( pct[ col ] / denom ) * 100.0
      else:
         pct[ col ] = 0.0

   if "Total" in pct.index:
      for col in pct.columns:
         pct.loc[ "Total", col ] = 100.0 if col_totals.get( col, 0.0 ) > 0 else 0.0

   # Rename rating index values using RATING_TEXT_LABELS ( keep Missing / Total )
   rating_label_map = { str( k ): v for k, v in RATING_TEXT_LABELS.items() }

   new_index = []
   for idx in counts.index:
      s = str( idx )
      new_index.append( rating_label_map.get( s, s ) )

   counts = counts.copy()
   pct = pct.copy()

   counts.index = new_index
   pct.index = new_index

   counts.index.name = "Rating"
   pct.index.name = "Rating"

   # Format percentages as strings
   pct_fmt = pct.copy()
   for col in pct_fmt.columns:
      pct_fmt[ col ] = pct_fmt[ col ].map( lambda x: f"{x:.1f}%" )

   # Combine into one table with a single header row
   combined = pd.DataFrame( index = counts.index )

   for col in counts.columns:
      col_str = str( col )
      combined[ f"{col_str} (Count)" ] = counts[ col ].astype( int )
      combined[ f"{col_str} (% of Column)" ] = pct_fmt[ col ]

   combined.index.name = "Rating"

   safe_category = friendly_category.replace( " ", "_" )
   safe_rating   = friendly_rating.replace( " ", "_" )
   filename = outdir / f"Crosstab_{safe_category}_by_{safe_rating}.csv"

   combined.to_csv( filename )

# ---------------------------------------------------------
def generate_comparison_charts( df, numeric_col, category_col ):
# ---------------------------------------------------------
   """
   Box plot of a numeric column grouped by a categorical column,
   then save as .png.
   """

   print( f" ... ... {category_col} ... " )
   
   outdir = FIGURES_ROOT / "comparison"
   outdir.mkdir( parents = True, exist_ok = True )

   friendly_num = FRIENDLY_NAMES.get( numeric_col, numeric_col )
   friendly_cat = FRIENDLY_NAMES.get( category_col, category_col )

   data = df.dropna( subset = [ numeric_col, category_col ] ).copy()

   if isinstance( data[ category_col ].dtype, CategoricalDtype ):
      categories = list( data[ category_col ].cat.categories )
   else:
      data[ category_col ] = data[ category_col ].astype( str )
      categories = sorted( data[ category_col ].unique() )

   values_by_cat = [
      data.loc[ data[ category_col ] == cat, numeric_col ]
      for cat in categories
   ]

   tick_labels = [ str( cat ) for cat in categories ]

   fig, ax = plt.subplots( figsize = ( 6, FIG_SIZE ) )

   ax.boxplot( values_by_cat, tick_labels = tick_labels, vert = True )
   ax.violinplot( values_by_cat, vert = True )

   if numeric_col == rating_col:
      y_min = int( df[ rating_col ].min() )
      y_max = int( df[ rating_col ].max() )

      tick_positions = list( range( y_min, y_max + 1 ) )
      tick_labels = [
         RATING_TEXT_LABELS.get( v, str( v ) )
         for v in tick_positions
      ]

      ax.set_yticks( tick_positions )
      ax.set_yticklabels( tick_labels )
      
   ax.set_axisbelow( True )
   ax.yaxis.grid(
      True,
      color = "#F2F2F2",
      linestyle = "-",
      linewidth = 0.8,
   )

   ax.set_title( f"{friendly_num} by {friendly_cat}", pad = 8 )
   ax.set_xlabel( "" )
   ax.set_ylabel( "" )

   plt.xticks( rotation = 45, ha = "right" )
   plt.tight_layout()

   safe_num = friendly_num.replace( " ", "_" )
   safe_cat = friendly_cat.replace( " ", "_" )
   filename = Path( outdir ) / f"{safe_num}_by_{safe_cat}.png"

   plt.savefig( filename, dpi = 300, bbox_inches = "tight" )
   plt.close()

# ---------------------------------------------------------
def check_for_0_ratings( df, column_name ):
# ---------------------------------------------------------
   """
   Checks for records with no rating.
   """
   
   rating_by_category = pd.crosstab(
      df[ column_name ],
      df[ rating_col ]
   ).reindex( columns = [ 1, 2, 3, 4, 5, 6, 7 ], fill_value = 0 )

   mask = rating_by_category.eq( 0 )
   has_zeros = mask.any().any()

   if has_zeros:
      zero_positions = mask.stack()
      zero_pairs = zero_positions[ zero_positions ].index.tolist()

      for zero_pair, rating_val in zero_pairs:
         print( f" ... ... {column_name} {zero_pair} with rating {rating_val}" )
   else:
      print( f" ... ... {column_name} had no zero-count rating combinations." )

# ---------------------------------------------------------
def outlier_summary_for_column( df, column_name ):
# ---------------------------------------------------------
   """
   Checks for outlier counts for given columns.
   """

   s = df[ column_name ].dropna()

   if s.empty:
      return {
         "column": column_name,
         "outlier_count": 0,
         "outlier_min": None,
         "outlier_median": None,
         "outlier_max": None,
      }, s

   q1 = s.quantile( 0.25 )
   q3 = s.quantile( 0.75 )
   iqr = q3 - q1

   lower = q1 - 1.5 * iqr
   upper = q3 + 1.5 * iqr

   outliers = s[ ( s < lower ) | ( s > upper ) ]

   if outliers.empty:
      summary_text = f"{column_name} had 0 outliers."
   else:
      count = int( outliers.shape[ 0 ] )
      total = int( s.shape[ 0 ] )
      outlier_pct = count / total * 100.0
      
      out_min = outliers.min()
      out_max = outliers.max()
      out_median = outliers.median()

      summary_text = (
         f"{column_name} values had {count} ({outlier_pct:.1f}%) outliers, "
         f"ranging from {out_min} to {out_max}, "
         f"with a median value of {out_median}."
      )

   print( f" ... ... {summary_text}" )
      
# ---------------------------------------------------------
def generate_repeated_words_csv( df, column_name ):
# ---------------------------------------------------------
   """
   Generate repeated words table,
   then save as .csv.
   """   

   print( f" ... ... {column_name} ... " )
   
   outdir = CSV_ROOT
   outdir.mkdir( parents = True, exist_ok = True )

   friendly_name = FRIENDLY_NAMES.get( column_name, column_name )

   text_series = (
      df[ column_name ]
      .fillna( "" )
      .astype( str )
      .str.replace( r"[^a-zA-Z\s]", " ", regex = True )
      .str.lower()
   )

   words_series = text_series.str.split().explode()
   words_series = words_series[ words_series.str.len() > 0 ]

   filtered_words = words_series[ ~words_series.isin( stop_words ) ]

   if filtered_words.empty:
      repeated_df = pd.DataFrame(
         columns = [ "word", "count", "percent_of_filtered_words" ]
      )
   else:
      word_counts = filtered_words.value_counts()

      repeated_counts = word_counts[ word_counts > 1 ]

      if repeated_counts.empty:
         repeated_df = pd.DataFrame(
            columns = [ "word", "count", "percent_of_filtered_words" ]
         )
      else:
         total_filtered = int( filtered_words.shape[ 0 ] )

         repeated_df = (
            repeated_counts
            .rename_axis( "word" )
            .reset_index( name = "count" )
         )

         repeated_df[ "percent_of_filtered_words" ] = (
            repeated_df[ "count" ] / total_filtered * 100.0
         )

   safe_name = friendly_name.replace( " ", "_" )
   filename = outdir / f"RepeatedWords_{safe_name}.csv"

   repeated_df.to_csv( filename, index = False )
   
# ---------------------------------------------------------
# Start Main Processing
# ---------------------------------------------------------

try:
   
   print( f"Reading data in from {gsheet_url} ... " )

   df = pd.read_csv( gsheet_url )

   # ADD COLUMNS
   df['PromptLength'] = df['Prompt'].str.len()
   df['ChatGPTLength'] = df['ChatGPT'].str.len()
   df['BardLength'] = df['Bard'].str.len()
   df['Rating'] = df['Which model is more helpful, safe, and honest? (text)'] + ' (' + df['Which model is more helpful, safe, and honest? (rating)'].astype(str) + ')'
   df['ExplanationLength'] = df['Explanation'].str.len().fillna(0)
   df['ExplanationLengthNonZero'] = df['Explanation'].str.len()
   df[ "ExplanationPresence" ] = np.where(
      df[ "Explanation" ].notna() & ( df[ "Explanation" ].astype( str ).str.len() > 0 ),
         "Has Explanation",
         "No Explanation"
   )
   df[ "PromptLengthBin" ] = pd.cut(
      df[ "PromptLength" ],
      bins = [
         -0.5,
         500,
         1000,
         2000,
         5000,
         10000,
         20000,
         float( "inf" ),
      ],
      labels = [
         "≤ 500",
         "501–1000",
         "1001–2000",
         "2001–5000",
         "5001–10000",
         "10001–20000",
         ">20000",
      ],
      ordered = True,
   )

   numeric_df = df.select_dtypes( include='number' )

   # ---------------------------------------------------------
   # Generate and save figures
   # ---------------------------------------------------------
   
   print( f" ... Generating data description tables for column ... ")
   for col in numeric_df.columns:
      generate_describe_table( numeric_df, col ) 
   
   print( f" ... Generating outlier summaries for column ... ")
   for col in numeric_df.columns:
      outlier_summary_for_column( numeric_df, col )

   print( f" ... Generating box/violin plots for column ... ")
   for col in numeric_df.columns:
      generate_plot_charts( numeric_df, col )  

   print( f" ... Generating category tables for column ... ")
   for col in [ "Prompt Category", "Complexity", "Rating", "ExplanationPresence" ]:
      generate_category_table( df, col )
      
   print( f" ... Generating crosstab csv for column ... ")
   for col in [ "PromptLengthBin", "Prompt Category", "Complexity" ]:
      generate_crosstab_csv( df, rating_col, col )
      
   print( f" ... Generating comparison charts for column ... ")
   for col in [ "PromptLengthBin", "Prompt Category", "Complexity" ]:
      generate_comparison_charts( df, rating_col, col )
   
   print( f" ... Checking for Options without ratings for column  ... ")
   for col in [ "Prompt Category", "Complexity" ]:
      check_for_0_ratings( df, col )

   print( f" ... Generating repeated words .CSV for column ... " )
   for col in [ "Explanation" ]:
      generate_repeated_words_csv( df, col )

except requests.exceptions.RequestException as e:
   print(f"Error fetching the file from URL: {e}")   

# ---------------------------------------------------------
print( 'Fini' )
# ---------------------------------------------------------
