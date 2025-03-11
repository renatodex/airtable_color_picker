import React, { useState } from 'react';
import { initializeBlock, useBase, useRecords, Button, Input, Box, Dialog, Text, Heading, useGlobalConfig, useLoadable, useWatchable, Select } from '@airtable/blocks/ui';
import { cursor } from '@airtable/blocks';

function ColorPickerBlock() {
    const base = useBase();

    // Watch for changes to the active table
    useWatchable(cursor, ['activeTableId']);

    // Get the current active table
    const activeTableId = cursor.activeTableId;
    const table = activeTableId ? base.getTableByIdIfExists(activeTableId) : null;

    // If no table is selected, show a message
    if (!table) {
        return (
            <Box padding={3} display="flex" alignItems="center" justifyContent="center" height="100vh">
                <Text size="large">Please select a table to use the Color Picker</Text>
            </Box>
        );
    }

    // Find all fields that might contain color values
    const findColorFields = () => {
        // Get all text fields
        const textFields = table.fields.filter(field =>
            field.type === 'singleLineText' ||
            field.type === 'multilineText' ||
            field.type === 'richText');

        return textFields;
    };

    const allPossibleColorFields = findColorFields();
    const [selectedFieldId, setSelectedFieldId] = useState('');

    // Get primary field and first attachment field
    const primaryField = table.primaryField;
    const attachmentField = table.fields.find(field => field.type === 'multipleAttachments');

    // Determine which field to display (prioritize attachment field if it exists)
    const displayField = attachmentField || primaryField;

    const records = useRecords(table);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [hexColor, setHexColor] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 10;
    const totalPages = Math.ceil(records.length / recordsPerPage);

    // Get current records for the page
    const indexOfLastRecord = currentPage * recordsPerPage;
    const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
    const currentRecords = records.slice(indexOfFirstRecord, indexOfLastRecord);

    // Check if a field contains valid hex color codes
    const isValidColorField = (fieldId) => {
        if (!fieldId || !records || records.length === 0) return false;

        // Check at least one record for a valid color value
        for (const record of records) {
            const value = record.getCellValue(fieldId);
            // Check if it's a hex color code or an object with backgroundColor property
            const isValidHex = typeof value === 'string' && /^#([0-9A-F]{3}){1,2}$/i.test(value);
            const isValidObject = typeof value === 'object' && value !== null &&
                                 typeof value === 'object' && 'backgroundColor' in value &&
                                 typeof value.backgroundColor === 'string' &&
                                 /^#([0-9A-F]{3}){1,2}$/i.test(value.backgroundColor);

            if (isValidHex || isValidObject) return true;
        }
        return false;
    };

    // Find eligible color fields (text fields with at least one hex color value)
    const eligibleColorFields = allPossibleColorFields.filter(field =>
        isValidColorField(field.id)
    );

    // Initialize selected field if not set yet
    if (eligibleColorFields.length > 0 && !selectedFieldId) {
        // First try to find a field named with "color" in it
        const colorNameField = eligibleColorFields.find(field =>
            field.name.toLowerCase().includes('color'));

        // Set the selected field to either the color-named field or the first eligible field
        setSelectedFieldId(colorNameField ? colorNameField.id : eligibleColorFields[0].id);
    }

    // Get the currently selected field object
    const field = selectedFieldId ? table.getFieldByIdIfExists(selectedFieldId) : null;

    const openColorPicker = (record) => {
        setSelectedRecord(record);
        // Get the current value, which might be a string or an object with text/backgroundColor
        const currentValue = field ? record.getCellValue(field.id) : null;
        // If it's an object with backgroundColor, use that, otherwise use the value directly or default
        const colorValue = typeof currentValue === 'object' && currentValue !== null && 'backgroundColor' in currentValue ?
            (currentValue.backgroundColor || '#000000') :
            (currentValue || '#000000');
        setHexColor(colorValue);
        setIsOpen(true);
    };

    const saveColor = async () => {
        if (selectedRecord && field) {
            // Save the hex color as a string, not as an object
            await table.updateRecordAsync(selectedRecord, {
                [field.id]: hexColor,
            });
        }
        setIsOpen(false);
    };

    // Helper function to render the display field content
    const renderDisplayField = (record) => {
        if (attachmentField) {
            const attachments = record.getCellValue(attachmentField.id);
            if (attachments && attachments.length > 0) {
                return (
                    <Box display="flex" alignItems="center">
                        <img
                            src={attachments[0].thumbnails.small.url}
                            alt={record.name || 'Image'}
                            style={{ width: '40px', height: '40px', objectFit: 'cover', marginRight: '8px' }}
                        />
                        <Text>{record.getCellValueAsString(primaryField.id) || 'Unnamed'}</Text>
                    </Box>
                );
            }
        }

        // Fallback to primary field value
        return <Text>{record.getCellValueAsString(primaryField.id) || 'Unnamed'}</Text>;
    };

    // If no eligible color fields are found
    if (eligibleColorFields.length === 0) {
        return (
            <Box padding={3} display="flex" alignItems="center" justifyContent="center" height="100vh">
                <Text size="large">No color fields found in this table. Please add a text field with hex color values.</Text>
            </Box>
        );
    }

    return (
        <Box padding={3}>
            <Box display="flex" alignItems="center" justifyContent="space-between" marginBottom={2}>
                <Heading size="small">Color Picker - {table.name}</Heading>

                {eligibleColorFields.length > 1 && (
                    <Select
                        options={eligibleColorFields.map(field => ({
                            value: field.id,
                            label: field.name
                        }))}
                        value={selectedFieldId}
                        onChange={newValue => setSelectedFieldId(newValue)}
                        width="200px"
                    />
                )}
            </Box>

            <Box
                border="thick"
                borderRadius={3}
                backgroundColor="white"
                overflow="hidden"
            >
                {currentRecords.map((record) => (
                    <Box
                        key={record.id}
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        padding={2}
                        borderBottom="default"
                    >
                        <Box display="flex" alignItems="center">
                            {renderDisplayField(record)}
                        </Box>

                        <Button
                            onClick={() => openColorPicker(record)}
                            style={{
                                backgroundColor: field && typeof record.getCellValue(field.id) === 'object' && record.getCellValue(field.id) !== null ?
                                    (record.getCellValue(field.id)?.backgroundColor || '#ccc') :
                                    (field ? record.getCellValue(field.id) || '#ccc' : '#ccc'),
                                width: '80px',
                                height: '30px'
                            }}
                            aria-label={`Select color for ${record.name || 'record'}`}
                        >
                            {field && typeof record.getCellValue(field.id) === 'object' && record.getCellValue(field.id) !== null ?
                                (record.getCellValue(field.id)?.text || 'Pick a color') :
                                (field ? record.getCellValue(field.id) || 'Pick a color' : 'Pick a color')}
                        </Button>
                    </Box>
                ))}
            </Box>

            {records.length > recordsPerPage && (
                <Box display="flex" justifyContent="center" marginTop={3}>
                    <div className="pagination">
                        <Button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            marginRight={1}
                        >
                            Previous
                        </Button>
                        <Text marginX={2}>
                            Page {currentPage} of {totalPages}
                        </Text>
                        <Button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            marginLeft={1}
                        >
                            Next
                        </Button>
                    </div>
                </Box>
            )}

            {isOpen && (
                <Dialog onClose={() => setIsOpen(false)} width="320px">
                    <Box padding={2}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <input
                                type="color"
                                value={hexColor}
                                onChange={(e) => setHexColor(e.target.value)}
                                style={{ width: '100%', height: '40px', marginBottom: '8px' }}
                                aria-label="Color picker"
                            />
                            <Input
                                type="text"
                                value={hexColor}
                                onChange={(e) => setHexColor(e.target.value)}
                                aria-label="Hex color value"
                            />
                        </div>
                        <Button variant="primary" onClick={saveColor} marginTop={2}>
                            Save
                        </Button>
                    </Box>
                </Dialog>
            )}
        </Box>
    );
}

initializeBlock(() => <ColorPickerBlock />);
