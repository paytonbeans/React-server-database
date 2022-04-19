import * as React from 'react';
import {
    List,
    Datagrid,
    TextField,
    Create,
    SimpleForm,
    TextInput,
    Show,
    SimpleShowlayout,
    Edit,
} from 'react-admin';
import GradesTable from './GradesTable'


export const StudentList = props => (
    <List {...props}>
        <Datagrid rowClick="show">
            <TextField source="id" />
            <TextField source="name" />
        </Datagrid>
    </List>
);

export const StudentShow = props => (
    <Show {...props}>
        <SimpleShowlayout>
            <TextField source="id" />
            <TextField source="name" />
            <GradesTable source="grades" />
        </SimpleShowlayout>
    </Show>
);

export const StudentCreate = props =>(
    <Create {...props}>
        <SimpleForm>
            <TextInput source = "id" />
            <TextInput source = "name" />
        </SimpleForm>
    </Create>
);

export const StudentEdit = props =>(
    <Edit {...props}>
        <SimpleForm>
            <TextField source = "id" />
            <TextInput source = "name" />

        </SimpleForm>
    </Edit>
);