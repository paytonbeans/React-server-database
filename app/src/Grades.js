import * as React from 'react';
import {
    List,
    Datagrid,
    TextField,
    Create,
    SimpleForm,
    TextInput,
    Edit,
    ReferenceField,
    NumberField,
    NumberInput,
} from 'react-admin';


export const GradeList = props => (
    <List {...props}>
        <Datagrid rowClick="show">
            <TextField source="id" />
            <NumberField source="type" />
            <ReferenceField reference="students" source="student_id">
                <TextField source="name" />
            </ReferenceField>
            <NumberField source="grade" />
            <NumberField source="max" />
        </Datagrid>
    </List>
);

export const GradeEdit = props =>(
    <Edit {...props}>
        <SimpleForm>
        <TextField source = "id" />
            <ReferenceField reference="students" source="student_id">
                <TextField source="name" />
            </ReferenceField>
            <TextInput source = "type" />
            <NumberInput source="grade" />
            <NumberInput source="max" />
        </SimpleForm>
    </Edit>
);

export const GradeCreate = props =>(
    <Create {...props}>
        <SimpleForm>
            <TextInput source = "student_id" />
            <TextInput source = "type" />
            <NumberInput source="grade" />
            <NumberInput source="max" />
        </SimpleForm>
    </Create>
);