"""
Subset Selector Application

A Streamlit application for selecting and managing video sequence subsets
with annotation options.
"""

import fnmatch
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

import requests
import streamlit as st
from requests.exceptions import RequestException


@dataclass
class SequenceEntry:
    """Represents a video sequence with its annotation suffix."""
    videoset: str
    camera: str
    annotation_suffix: str = "Undefined"

    @property
    def sequence_id(self) -> str:
        """Unique identifier for the sequence."""
        return f"{self.videoset}_{self.camera}"


@dataclass
class SubsetSelectorState:
    """Manages the application state."""
    videosets: Dict = field(default_factory=dict)
    current_subset_list: List[SequenceEntry] = field(default_factory=list)
    sequences_per_suffix: Dict[str, List[str]] = field(default_factory=lambda: defaultdict(list))


class APIClient:
    """Handles API communication with error handling."""

    def __init__(self, base_url: str = "http://localhost:5000"):
        self.base_url = base_url

    def get_available_videosets(self) -> Dict:
        """Fetch available videosets from the API."""
        try:
            response = requests.get(f"{self.base_url}/videosets", timeout=10)
            response.raise_for_status()
            return response.json()
        except RequestException as e:
            st.error(f"Failed to fetch videosets: {e}")
            return {}

    def get_annotation_options(self, videoset: str, camera: str) -> List[str]:
        """Fetch annotation options for a specific videoset and camera."""
        try:
            # URL encode camera path by replacing '/' with '___'
            encoded_camera = camera.replace("/", "___")
            response = requests.get(
                f"{self.base_url}/annotations/options/{videoset}/{encoded_camera}",
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except RequestException as e:
            st.error(f"Failed to fetch annotation options for {videoset}/{camera}: {e}")
            return []

    def save_subset(self, name: str, subset_data: List[Dict]) -> bool:
        """Save a subset to the server."""
        try:
            response = requests.post(
                f"{self.base_url}/subset",
                json={"name": name, "data": subset_data},
                timeout=10
            )
            response.raise_for_status()
            return True
        except RequestException as e:
            st.error(f"Failed to save subset '{name}': {e}")
            return False

    def get_available_subsets(self) -> List[str]:
        """Get list of available saved subsets."""
        try:
            response = requests.get(f"{self.base_url}/subsets", timeout=10)
            response.raise_for_status()
            return response.json()
        except RequestException as e:
            st.error(f"Failed to fetch available subsets: {e}")
            return []

    def load_subset(self, name: str) -> List[Dict]:
        """Load a subset from the server."""
        try:
            response = requests.get(f"{self.base_url}/subset/{name}", timeout=10)
            response.raise_for_status()
            return response.json()
        except RequestException as e:
            st.error(f"Failed to load subset '{name}': {e}")
            return []


class SubsetSelector:
    """Main application class for subset selection."""

    def __init__(self):
        self.api_client = APIClient()
        self._initialize_session_state()

    def _initialize_session_state(self):
        """Initialize session state with default values."""
        if "subset_selector_state" not in st.session_state:
            st.session_state.subset_selector_state = SubsetSelectorState()

        # Initialize videosets if not already loaded
        if not st.session_state.subset_selector_state.videosets:
            st.session_state.subset_selector_state.videosets = self.api_client.get_available_videosets()

    @property
    def state(self) -> SubsetSelectorState:
        """Get the current application state."""
        return st.session_state.subset_selector_state

    def render_pattern_inputs(self) -> Tuple[str, str]:
        """Render and return the pattern input fields."""
        videoset_pattern = st.text_input(
            "Videoset glob pattern",
            value="*leusderheide*",
            help="Use glob patterns like '*pattern*' to match videoset names"
        )
        camera_pattern = st.text_input(
            "Camera glob pattern",
            value="*halfres*",
            help="Use glob patterns like '*pattern*' to match camera names"
        )
        return videoset_pattern, camera_pattern

    def find_matching_sequences(self, videoset_pattern: str, camera_pattern: str):
        """Find sequences matching the given patterns."""
        if not self.state.videosets:
            st.warning("No videosets available. Please check the API connection.")
            return

        self.state.current_subset_list.clear()
        available_videosets = fnmatch.filter(self.state.videosets.keys(), videoset_pattern)

        sequence_count = 0
        for videoset in available_videosets:
            cameras = self.state.videosets[videoset]["cameras"]
            available_cameras = fnmatch.filter(cameras, camera_pattern)

            for camera in available_cameras:
                sequence = SequenceEntry(videoset=videoset, camera=camera)
                self.state.current_subset_list.append(sequence)
                sequence_count += 1

        if sequence_count == 0:
            st.warning("No sequences found matching the specified patterns.")
        else:
            st.success(f"Found {sequence_count} matching sequences")

    def fetch_annotation_options(self):
        """Fetch annotation options for all current sequences."""
        if not self.state.current_subset_list:
            st.warning("No sequences selected. Please find matching sequences first.")
            return

        # Clear previous annotation data
        self.state.sequences_per_suffix.clear()

        progress_bar = st.progress(0)
        total_sequences = len(self.state.current_subset_list)

        for i, sequence in enumerate(self.state.current_subset_list):
            options = self.api_client.get_annotation_options(sequence.videoset, sequence.camera)

            for option in options:
                self.state.sequences_per_suffix[option].append(sequence.sequence_id)

            progress_bar.progress((i + 1) / total_sequences)

        progress_bar.empty()

        if self.state.sequences_per_suffix:
            st.success(f"Found annotation options for {len(self.state.sequences_per_suffix)} suffixes")
        else:
            st.warning("No annotation options found for the selected sequences.")

    def render_sequence_management_buttons(self):
        """Render buttons for managing the current sequence list."""
        col1, col2, col3, col4 = st.columns(4)

        with col1:
            if st.button("Clear current subset list", type="secondary"):
                self._clear_current_subset()

        with col2:
            if st.button("Remove undefined annotations", type="secondary"):
                self._remove_undefined_annotations()

        with col3:
            if st.button("Save Subset", type="primary"):
                st.session_state.show_save_dialog = True
                st.rerun()

        with col4:
            if st.button("Load Subset", type="primary"):
                st.session_state.show_load_dialog = True
                st.rerun()

    def _clear_current_subset(self):
        """Clear all current subset data."""
        self.state.current_subset_list.clear()
        self.state.sequences_per_suffix.clear()
        st.rerun()

    def _remove_undefined_annotations(self):
        """Remove sequences with undefined annotation suffixes."""
        initial_count = len(self.state.current_subset_list)
        self.state.current_subset_list = [
            seq for seq in self.state.current_subset_list
            if seq.annotation_suffix != "Undefined"
        ]
        final_count = len(self.state.current_subset_list)
        removed_count = initial_count - final_count

        if removed_count > 0:
            st.success(f"Removed {removed_count} sequences with undefined annotations")
            st.rerun()
        else:
            st.info("No sequences with undefined annotations found")

    def _show_save_subset_dialog(self):
        """Show dialog for saving the current subset."""
        if not self.state.current_subset_list:
            st.warning("No sequences to save. Please select some sequences first.")
            st.session_state.show_save_dialog = False
            return

        with st.form("save_subset_form"):
            st.write("### Save Current Subset")
            subset_name = st.text_input(
                "Subset Name",
                help="Enter a name for this subset (will be saved as .csv file)"
            )

            # Show preview of what will be saved
            st.write(f"**Preview:** Saving {len(self.state.current_subset_list)} sequences")

            col1, col2 = st.columns(2)
            with col1:
                if st.form_submit_button("Save", type="primary"):
                    if subset_name.strip():
                        self._save_current_subset(subset_name.strip())
                        st.session_state.show_save_dialog = False
                        st.rerun()
                    else:
                        st.error("Please enter a valid subset name")

            with col2:
                if st.form_submit_button("Cancel"):
                    st.session_state.show_save_dialog = False
                    st.rerun()

    def _show_load_subset_dialog(self):
        """Show dialog for loading a saved subset."""
        available_subsets = self.api_client.get_available_subsets()

        if not available_subsets:
            st.info("No saved subsets found.")
            if st.button("Close"):
                st.session_state.show_load_dialog = False
                st.rerun()
            return

        with st.form("load_subset_form"):
            st.write("### Load Saved Subset")
            selected_subset = st.selectbox(
                "Choose a subset to load:",
                options=available_subsets,
                help="Select a previously saved subset"
            )

            col1, col2 = st.columns(2)
            with col1:
                if st.form_submit_button("Load", type="primary"):
                    if selected_subset:
                        self._load_subset(selected_subset)
                        st.session_state.show_load_dialog = False
                        st.rerun()

            with col2:
                if st.form_submit_button("Cancel"):
                    st.session_state.show_load_dialog = False
                    st.rerun()

    def _save_current_subset(self, name: str):
        """Save the current subset to the server."""
        # Convert sequences to the format expected by the API
        subset_data = [
            {
                "videoset": seq.videoset,
                "camera": seq.camera,
                "annotation_suffix": seq.annotation_suffix
            }
            for seq in self.state.current_subset_list
        ]

        if self.api_client.save_subset(name, subset_data):
            st.success(f"Successfully saved subset '{name}' with {len(subset_data)} sequences")
        else:
            st.error(f"Failed to save subset '{name}'")

    def _load_subset(self, name: str):
        """Load a subset from the server."""
        subset_data = self.api_client.load_subset(name)

        if not subset_data:
            st.error(f"Failed to load subset '{name}' or subset is empty")
            return

        # Clear current list and load new sequences
        self.state.current_subset_list.clear()
        self.state.sequences_per_suffix.clear()

        for item in subset_data:
            sequence = SequenceEntry(
                videoset=item.get("videoset", ""),
                camera=item.get("camera", ""),
                annotation_suffix=item.get("annotation_suffix", "Undefined")
            )
            self.state.current_subset_list.append(sequence)

        st.success(f"Successfully loaded subset '{name}' with {len(subset_data)} sequences")

    def render_current_sequences(self):
        """Display the current list of sequences."""
        if not self.state.current_subset_list:
            return

        # Show summary statistics
        total_sequences = len(self.state.current_subset_list)
        defined_annotations = len([seq for seq in self.state.current_subset_list if seq.annotation_suffix != "Undefined"])
        unique_videosets = len(set(seq.videoset for seq in self.state.current_subset_list))

        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Total Sequences", total_sequences)
        with col2:
            st.metric("With Annotations", defined_annotations)
        with col3:
            st.metric("Unique Videosets", unique_videosets)

        # Convert to display format
        display_data = [
            {
                "Videoset": seq.videoset,
                "Camera": seq.camera,
                "Annotation Suffix": seq.annotation_suffix
            }
            for seq in self.state.current_subset_list
        ]

        st.dataframe(display_data, use_container_width=True)

    def render_annotation_options(self):
        """Render annotation options and application buttons."""
        if not self.state.sequences_per_suffix:
            return

        st.write("### Annotation Options")

        for suffix, sequences in self.state.sequences_per_suffix.items():
            st.write(f"**{suffix}** ({len(sequences)} sequences)")

            col1, col2 = st.columns([3, 1])

            with col1:
                with st.expander(f"Show sequences for '{suffix}'"):
                    st.write(sequences)

            with col2:
                if st.button(
                    f"Apply '{suffix}'",
                    key=f"apply_{suffix}",
                    help=f"Apply annotation suffix '{suffix}' to {len(sequences)} sequences"
                ):
                    self._apply_annotation_suffix(suffix, sequences)

    def _apply_annotation_suffix(self, suffix: str, sequences: List[str]):
        """Apply an annotation suffix to the specified sequences."""
        updated_count = 0

        for sequence in self.state.current_subset_list:
            if sequence.sequence_id in sequences:
                sequence.annotation_suffix = suffix
                updated_count += 1

        if updated_count > 0:
            st.success(f"Applied suffix '{suffix}' to {updated_count} sequences")
            st.rerun()
        else:
            st.warning(f"No sequences found to apply suffix '{suffix}'")

    def run(self):
        """Main application entry point."""
        st.set_page_config(
            page_title="Subset Selector",
            page_icon="🎬",
            layout="wide"
        )

        st.title("🎬 Video Subset Selector")
        st.markdown("Select and manage video sequence subsets with annotation options.")

        # Pattern inputs
        videoset_pattern, camera_pattern = self.render_pattern_inputs()

        # Action buttons
        col1, col2 = st.columns(2)

        with col1:
            if st.button("Find Matching Sequences", type="primary"):
                self.find_matching_sequences(videoset_pattern, camera_pattern)

        with col2:
            if st.button("Fetch Annotation Options", type="primary"):
                self.fetch_annotation_options()

        # Current sequences management
        if self.state.current_subset_list:
            st.divider()
            self.render_sequence_management_buttons()
            self.render_current_sequences()

        # Annotation options
        if self.state.sequences_per_suffix:
            st.divider()
            self.render_annotation_options()

        # Handle modal dialogs
        if st.session_state.get("show_save_dialog", False):
            self._show_save_subset_dialog()

        if st.session_state.get("show_load_dialog", False):
            self._show_load_subset_dialog()


def main():
    """Application entry point."""
    app = SubsetSelector()
    app.run()


if __name__ == "__main__":
    main()
