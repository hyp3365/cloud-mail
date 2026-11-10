import http from '@/axios/index.js';

export function auditList(params) {
    return http.get('/audit/list', { params: { ...params } })
}
