from services.validators.link_validator import LinkValidator


class ValidationService:
    @staticmethod
    def validate_input(data):
        """
        Validate all links in the input data.

        Args:
            data (dict): Input data containing links with IP addresses and subnet info.

        Returns:
            bool, list: Returns a boolean indicating validation success and a list of errors.
        """
        errors = []

        # Iterate through each link in the input data
        for link in data.get("links", []):
            link_errors = LinkValidator.validate_link(link)
            errors.extend(link_errors)

        # Return validation result
        return len(errors) == 0, errors
