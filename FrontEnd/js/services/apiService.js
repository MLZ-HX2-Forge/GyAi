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

            const fetchOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(body)
            };

            if (options.signal) {
                fetchOptions.signal = options.signal;
            }

            const response = await fetch(url, fetchOptions);

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
    async *readStream(response, signal) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                if (signal && signal.aborted) {
                    reader.cancel();
                    break;
                }

                const { done, value } = await reader.read();

                if (done) {
                    if (buffer.trim()) {
                        if (buffer.startsWith('data: ')) {
                            const data = buffer.slice(6);
                            if (data !== '[DONE]') {
                                try {
                                    yield JSON.parse(data);
                                } catch (e) {
                                    console.error('解析SSE数据错误:', e);
                                }
                            }
                        }
                    }
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
                            console.error('解析SSE数据错误:', e, '数据:', data);
                        }
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('流已中止');
                return;
            }
            console.error('读取流错误:', error);
            throw error;
        }
    },

    async processStream(response, callbacks, signal) {
        const { onContent, onError, onDone } = callbacks;

        if (!response.ok) {
            const errorMsg = `HTTP错误: ${response.status}`;
            try {
                const errorData = await response.json();
                onError && onError(errorData.message || errorMsg);
            } catch {
                onError && onError(errorMsg);
            }
            return;
        }

        try {
            for await (const data of this.readStream(response, signal)) {
                if (signal && signal.aborted) {
                    break;
                }

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
            if (error.name === 'AbortError') {
                console.log('处理流已中止');
                return;
            }
            console.error('处理流错误:', error);
            onError && onError(error.message || '处理响应时发生错误');
        }
    }
};
