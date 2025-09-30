
from vset_utils.vset_select import (
    get_annotation_options,
    get_mediamanager,
    get_timeseries_options,
    get_videosets,
)

videoset_name = 'leusderheide_20230705'
camera = "visual_halfres/CPFS7_0310"
mm = get_mediamanager('leusderheide_20230705',"visual_halfres/CPFS7_0310")
options = get_timeseries_options(mm)
annotations_options = get_annotation_options(mm)
print(annotations_options)
