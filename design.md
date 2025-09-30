### Backend

- Use flask and make it object oriented.
- Endpoints for getting all timestamps in the media manager
- Endpoint for setting the current videoset camera combination
- Endpoint for retreiving timeseries data in format. It should be efficient and handle 100k+ datapoints. This endpoint should take the currently loaded pandas dataframe, select the currently selected columns + timestamp and put them in format X: <timestamp array>, y:<y array>, z: <z array>. Timeseries should only be gettable and not settable
- Post endpoint for setting the currently selected timeseries data
- Endpoint for column options for the currently selected timeseries data.
- Post endpoint for setting currently selected column for y and z
- Endpoint for getting a frame at a specified timestamp.
- Endpoint for annotations in x,y,z format (same format as timeseries)
- Endpoint for getting detections at a given timestamp, should return a dict json object with all properties (so not just xyz)

### Sidebar

The sidebar contains a selectboxes to select

- What column of the dataframe should be on the Y axis.
- What column of the dataframe be on the Z axis / colour axis.

### Interactive Frame

- The interactive frame depicts the video frame for the current selected timestamp.
- Users can zoom in the interactive frame.
- Users can draw bounding boxes on the interactive frame.

### XT Plot

- The x axis will be the time axis, and contain the timestamps associated with the video
- The user can click anywhere in the plot to select the timestamp associated with that position in the plot.
- When the user hovers over the plot, he sees a vertical red line at this mouse positiion.
- The plot should work with three dimensional data so X,Y,Z where Z should be used to give color to the plot.
- The component should support both line and scatterplots based on a prop.