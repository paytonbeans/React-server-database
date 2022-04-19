import * as React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

const GradesTable = (props) => {
    const grades = props.record.grades || [];
    return (
        <TableContainer component={Paper}>
            <Table sx={{minWidth: 650}} aria-label="Grades">
                <TableHead>
                    <TableRow>
                        <TableCell>id</TableCell>
                        <TableCell>type</TableCell>
                        <TableCell>grade</TableCell>
                        <TableCell>max</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {grades.map((grade) =>(
                        <TableRow
                            key ={grade.id}
                            sx={{'&:last-child td, &:last-child th': {border: 0}}}
                        >
                        <TableCell component="th" scope="row">
                            {grade.id}
                        </TableCell>
                        <TableCell >{grade.type}</TableCell>
                        <TableCell >{grade.grade}</TableCell>
                        <TableCell >{grade.max}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    )
}