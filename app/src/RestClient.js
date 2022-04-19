import { fetchUtils } from 'react-admin';
import RestClient from 'ra-data-json-server';

const MyRestClient = (apiurl, httpClient) => {
    const client = RestClient(apiurl, httpClient)
    return {
        getlist: (resource, params) =>{
            console.log("calling getList")
            return client.getList(resource, params)
        },
        getOne: (resource, params) =>{
            console.log("calling getOne")
            if (resource == 'students'){
                return client.getOne(resource, params)
                    .then((record) =>{
                        const student_id = record.data.id
                        const gradesParams = {
                            filter: {student_id},
                            sort: {field: "id", order: "ASC"},
                            pagination: {page:1, perPage:100}
                        }
                        return client.getList('grades', gradesParams)
                        .then((grades)=>{
                            record.data.grades = grades.data;
                            return record;
                        })
                    })
            }
            else{
                return client.getOne(resource, params)
            } 
        },
        getMany: (resource, params) =>{
            console.log("calling getMany")
            const promises = [];
            const records = [];
            for(let i =0; i< params.ids.length; i++){
                const id = params.ids[i]
                promises.push(
                    client.getOne(resource, {id})
                    .then((response) => {
                        records.push(resource.data)
                    })
                );
            }
            return Promise.all(promises).then(()=>({data:records}))
        },
        getManyReference: (resource, params) =>{
            console.log("calling getManyReference")
            return client.getManyReference(resource, params)
        },
        update: (resource, params) =>{
            console.log("calling update")
            return client.update(resource, params)
        },
        updateMany: (resource, params) =>{
            console.log("calling updateMany")
            return client.updateMany(resource, params)
        },
        create: (resource, params) => {
            console.log("calling create")
            return client.create(resource, params)
        },
        delete: (resource, params) =>{
            console.log("calling delete")
            return client.delete(resource, params)
        },
        deleteMany: (resource, params) =>{
            console.log("calling deleteMany")
            return client.deleteMany(resource, params)
        }
    }
}

export default MyRestClient;