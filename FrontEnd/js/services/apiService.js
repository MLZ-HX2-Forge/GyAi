/**
 * API服务模块
 * 处理所有后端API请求
 */

const API = {
    baseUrl: '',
    
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const token = Utils.cookie.get('gyai_session');
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include'
        };
        
        if (token) {
            defaultOptions.headers['Authorization'] = `Bearer ${token}`;
        }
        
        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };
        
        try {
            const response = await fetch(url, mergedOptions);
            const data = await response.json();
            
            if (response.status === 401) {
                Auth.handleUnauthorized();
            }
            
            return data;
        } catch (error) {
            console.error('API请求错误:', error);
            throw error;
        }
    },
    
    auth: {
        async register(username, password, email = null, nickname = null) {
            return API.request('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, password, email, nickname })
            });
        },
        
        async login(username, password) {
            return API.request('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
        },
        
        async guest() {
            return API.request('/api/auth/guest', {
                method: 'POST'
            });
        },
        
        async logout() {
            return API.request('/api/auth/logout', {
                method: 'POST'
            });
        },
        
        async me() {
            return API.request('/api/auth/me');
        },
        
        async update(data) {
            return API.request('/api/auth/me', {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        },
        
        async checkUsername(username) {
            return API.request('/api/auth/check-username', {
                method: 'POST',
                body: JSON.stringify({ username })
            });
        }
    },
    
    chat: {
        async stream(message, options = {}) {
            const token = Utils.cookie.get('gyai_session');
            const url = `${API.baseUrl}/api/chat/stream`;
            
            const body = {
                message,
                model: options.model || 'deepseek',
                history: options.history || [],
                images: options.images || [],
                conversation_id: options.conversationId,
                use_knowledge: options.useKnowledge !== false
            };
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(body)
            });
            
            return response;
        },
        
        async sync(message, options = {}) {
            return API.request('/api/chat/sync', {
                method: 'POST',
                body: JSON.stringify({
                    message,
                    model: options.model || 'deepseek',
                    history: options.history || [],
                    images: options.images || [],
                    use_knowledge: options.useKnowledge !== false
                })
            });
        },
        
        async getModels() {
            return API.request('/api/chat/models');
        },
        
        async getKnowledgeCategories() {
            return API.request('/api/chat/knowledge/categories');
        }
    },
    
    conversations: {
        async list(page = 1, pageSize = 20) {
            return API.request(`/api/conversations?page=${page}&page_size=${pageSize}`);
        },
        
        async create(title = '新对话', model = 'deepseek') {
            return API.request('/api/conversations', {
                method: 'POST',
                body: JSON.stringify({ title, model })
            });
        },
        
        async get(id) {
            return API.request(`/api/conversations/${id}`);
        },
        
        async update(id, data) {
            return API.request(`/api/conversations/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        },
        
        async delete(id) {
            return API.request(`/api/conversations/${id}`, {
                method: 'DELETE'
            });
        },
        
        async getMessages(id, limit = 100) {
            return API.request(`/api/conversations/${id}/messages?limit=${limit}`);
        }
    }
};

const SSEClient = {
    async *readStream(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                break;
            }
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        return;
                    }
                    try {
                        yield JSON.parse(data);
                    } catch (e) {
                        console.error('解析SSE数据错误:', e);
                    }
                }
            }
        }
    },
    
    async processStream(response, callbacks) {
        const { onContent, onError, onDone } = callbacks;
        
        try {
            for await (const data of this.readStream(response)) {
                if (data.error) {
                    onError && onError(data.error);
                    return;
                }
                if (data.content) {
                    onContent && onContent(data.content);
                }
            }
            onDone && onDone();
        } catch (error) {
            onError && onError(error.message);
        }
    }
};
